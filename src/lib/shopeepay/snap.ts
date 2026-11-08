// Client HTTP ShopeePay SNAP — SERVER-ONLY.
// JANGAN diimpor dari Client Component: file ini memakai private key
// dan client secret toko (didekripsi di server) untuk signing.
//
// Alur:
//   1. requestAccessToken — POST /v1.0/access-token/b2b (service 73),
//      tanda tangan RSA-SHA256 atas `clientId|timestamp`. Token berlaku
//      900 detik; dipakai ulang dari cache in-memory selama masih berlaku
//      (margin 60 detik), diambil ulang otomatis bila ditolak.
//   2. generateDynamicQr — POST /v1.0/qr/qr-mpm-generate (service 47),
//      tanda tangan HMAC-SHA512. Mengembalikan qrContent + validUpTo.
//   3. queryQrStatus — inquiry cadangan bila webhook belum datang.
//
// Host default = sandbox ShopeePay. Host + path inquiry WAJIB
// dikonfirmasi ke dokumen ShopeePay Partner saat kredensial sandbox
// tiba — keduanya bisa di-override lewat env SHOPEEPAY_BASE_URL dan
// SHOPEEPAY_QR_STATUS_PATH tanpa mengubah kode lain.

import {
  buildTokenStringToSign,
  buildTxStringToSign,
  signRsaSha256,
  signTxHmacSha512,
} from '@/lib/shopeepay/crypto'
import {
  buildQrGenerateBody,
  buildTokenBody,
  parseQrGenerateResponse,
  parseQrStatusResponse,
  qrExpiryDate,
  toSnapIso,
  type QrGenerateResult,
} from '@/lib/shopeepay/payload'

export const SHOPEEPAY_TOKEN_PATH = '/v1.0/access-token/b2b'
export const SHOPEEPAY_QR_GENERATE_PATH = '/v1.0/qr/qr-mpm-generate'
/**
 * Path inquiry status QR — BELUM TERKONFIRMASI dari dokumen Partner
 * (rencana 7 Nov hanya menamai service code 47/73). Sebelum dipakai
 * live, samakan dengan dokumen ShopeePay Partner; kegagalan inquiry
 * TIDAK PERNAH menggagalkan checkout — status lokal yang dipakai.
 */
export const SHOPEEPAY_QR_STATUS_PATH =
  process.env.SHOPEEPAY_QR_STATUS_PATH || '/v1.0/qr/qr-mpm-query'

export function getShopeePayBaseUrl(): string {
  return (
    process.env.SHOPEEPAY_BASE_URL || 'https://api.sandbox.shopeepay.co.id'
  ).replace(/\/$/, '')
}

export class ShopeePayError extends Error {
  responseCode?: string
  constructor(message: string, responseCode?: string) {
    super(message)
    this.name = 'ShopeePayError'
    this.responseCode = responseCode
  }
}

export interface ShopeePayCredentials {
  clientId: string
  clientSecret: string
  privateKeyPem: string
  merchantId: string
}

interface CachedToken {
  token: string
  expiresAtMs: number
}

// Cache token per clientId (satu proses server). Bila proses restart,
// token diambil ulang — aman, karena token B2B memang berumur pendek.
const tokenCache = new Map<string, CachedToken>()

function snapTimestamp(now: Date = new Date()): string {
  return toSnapIso(now)
}

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs = 15000
): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    const text = await res.text()
    try {
      return JSON.parse(text) as unknown
    } catch {
      throw new ShopeePayError(
        `ShopeePay mengembalikan respons bukan JSON (HTTP ${res.status}).`
      )
    }
  } catch (error) {
    if (error instanceof ShopeePayError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ShopeePayError('Permintaan ke ShopeePay kehabisan waktu.')
    }
    throw new ShopeePayError(
      `Gagal menghubungi ShopeePay: ${error instanceof Error ? error.message : 'unknown'}`
    )
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Ambil (atau pakai ulang) token B2B untuk satu clientId. Token yang
 * sudah kedaluwarsa dibuang dari cache.
 */
export async function requestAccessToken(
  creds: Pick<ShopeePayCredentials, 'clientId' | 'clientSecret' | 'privateKeyPem'>
): Promise<string> {
  const cached = tokenCache.get(creds.clientId)
  if (cached && cached.expiresAtMs > Date.now() + 60_000) {
    return cached.token
  }

  const timestamp = snapTimestamp()
  const stringToSign = buildTokenStringToSign(creds.clientId, timestamp)
  const signature = signRsaSha256(creds.privateKeyPem, stringToSign)

  const json = await fetchJson(
    `${getShopeePayBaseUrl()}${SHOPEEPAY_TOKEN_PATH}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TIMESTAMP': timestamp,
        'X-CLIENT-KEY': creds.clientId,
        'X-SIGNATURE': signature,
      },
      body: JSON.stringify(buildTokenBody()),
    }
  )

  if (typeof json !== 'object' || json === null) {
    throw new ShopeePayError('Respons token ShopeePay tidak dikenal.')
  }
  const obj = json as Record<string, unknown>
  const code = String(obj.responseCode ?? '')
  if (!code.startsWith('200')) {
    throw new ShopeePayError(
      `ShopeePay menolak token: ${String(obj.responseMessage ?? code)}`,
      code
    )
  }
  const data = obj.data as Record<string, unknown> | undefined
  const token = data?.accessToken
  if (typeof token !== 'string' || !token) {
    throw new ShopeePayError('Respons token ShopeePay tidak berisi accessToken.')
  }
  const expiresInSec = Number(data?.expiresIn ?? 900) || 900
  tokenCache.set(creds.clientId, {
    token,
    expiresAtMs: Date.now() + expiresInSec * 1000,
  })
  return token
}

export interface GenerateQrInput extends ShopeePayCredentials {
  storeId: string
  partnerReferenceNo: string
  amount: number
}

export interface GenerateQrOutput extends QrGenerateResult {
  expiresAt: Date
}

/**
 * Generate QR dinamis MPM untuk satu invoice. Mengembalikan qrContent
 * (string QR mentah — dirender jadi gambar di halaman invoice) dan
 * masa berlakunya. Error dilempar sebagai ShopeePayError; pemanggil
 * (checkout / invoice) WAJIB menangkapnya dan jatuh ke alur manual.
 */
export async function generateDynamicQr(
  input: GenerateQrInput
): Promise<GenerateQrOutput> {
  const accessToken = await requestAccessToken(input)
  const timestamp = snapTimestamp()
  const validUpTo = qrExpiryDate()
  const body = buildQrGenerateBody({
    partnerReferenceNo: input.partnerReferenceNo,
    amount: input.amount,
    merchantId: input.merchantId,
    storeId: input.storeId,
    validUpTo,
  })
  const minifiedBody = JSON.stringify(body)
  const stringToSign = buildTxStringToSign(
    'POST',
    SHOPEEPAY_QR_GENERATE_PATH,
    accessToken,
    minifiedBody,
    timestamp
  )

  const json = await fetchJson(
    `${getShopeePayBaseUrl()}${SHOPEEPAY_QR_GENERATE_PATH}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TIMESTAMP': timestamp,
        'X-CLIENT-KEY': input.clientId,
        'X-SIGNATURE': signTxHmacSha512(input.clientSecret, stringToSign),
        Authorization: `Bearer ${accessToken}`,
      },
      body: minifiedBody,
    }
  )

  const parsed = parseQrGenerateResponse(json)
  if (!parsed) {
    const obj = json as Record<string, unknown>
    throw new ShopeePayError(
      `ShopeePay menolak generate QR: ${String(obj?.responseMessage ?? obj?.responseCode ?? 'unknown')}`,
      String(obj?.responseCode ?? '')
    )
  }
  return { ...parsed, expiresAt: validUpTo }
}

/**
 * Inquiry status transaksi (cadangan bila webhook telat/hilang).
 * Mengembalikan 'PAID' bila ShopeePay menyatakan lunas, null bila
 * tidak bisa disimpulkan — pemanggil memakai status lokal.
 */
export async function queryQrStatus(
  creds: ShopeePayCredentials,
  partnerReferenceNo: string
): Promise<'PAID' | null> {
  try {
    const accessToken = await requestAccessToken(creds)
    const timestamp = snapTimestamp()
    const body = JSON.stringify({
      partnerReferenceNo,
      merchantId: creds.merchantId,
    })
    const stringToSign = buildTxStringToSign(
      'POST',
      SHOPEEPAY_QR_STATUS_PATH,
      accessToken,
      body,
      timestamp
    )
    const json = await fetchJson(
      `${getShopeePayBaseUrl()}${SHOPEEPAY_QR_STATUS_PATH}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TIMESTAMP': timestamp,
          'X-CLIENT-KEY': creds.clientId,
          'X-SIGNATURE': signTxHmacSha512(creds.clientSecret, stringToSign),
          Authorization: `Bearer ${accessToken}`,
        },
        body,
      }
    )
    return parseQrStatusResponse(json)
  } catch {
    // Inquiry gagal = status lokal yang dipakai (bukan error fatal).
    return null
  }
}

/** Dipakai tes untuk mengosongkan cache token antar kasus. */
export function clearTokenCacheForTests(): void {
  tokenCache.clear()
}
