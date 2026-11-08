// Pembangun payload ShopeePay SNAP (Fase 3) — fungsi MURNI.
// Dokumen rencana: rencana QRIS dinamis ShopeePay (7 Nov 2026).
// - Token B2B: POST /v1.0/access-token/b2b (service code 73).
// - Create Dynamic QR MPM: POST /v1.0/qr/qr-mpm-generate (service 47).
// - Masa berlaku QR default 1200 detik (20 menit), token 900 detik.
//
// File ini TIDAK memanggil jaringan dan TIDAK memegang secret —
// pemanggilan HTTP ada di src/lib/shopeepay/snap.ts.

/** Masa berlaku QR dinamis (detik) — default ShopeePay 1200 dtk. */
export const QR_EXPIRY_SECONDS = 1200

/** Masa berlaku token B2B (detik) — default 900 dtk. */
export const TOKEN_TTL_SECONDS = 900

/** Prefix partnerReferenceNo — unik per invoice + percobaan generate. */
export const PARTNER_REF_PREFIX = 'CUAN'

/**
 * partnerReferenceNo untuk sebuah invoice. SNAP membatasi 64 karakter,
 * jadi nomor invoice + counter dipangkas bila perlu. Generate ulang QR
 * untuk invoice yang sama HARUS memakai nomor baru (aturan ShopeePay),
 * makanya ada `attempt` (1, 2, 3, ...).
 */
export function partnerReferenceNoFor(
  invoiceNumber: string,
  attempt: number = 1
): string {
  const clean = invoiceNumber.replace(/[^A-Za-z0-9]/g, '-')
  const ref = `${PARTNER_REF_PREFIX}-${clean}-${Math.max(1, Math.floor(attempt))}`
  return ref.slice(0, 64)
}

/** Format ISO 8601 SNAP dengan offset WIB (+07:00). */
export function toSnapIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000)
  return (
    `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())}` +
    `T${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}:${pad(wib.getUTCSeconds())}+07:00`
  )
}

export function qrExpiryDate(from: Date = new Date()): Date {
  return new Date(from.getTime() + QR_EXPIRY_SECONDS * 1000)
}

export function isQrExpired(expiresAt: string | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false
  return now >= new Date(expiresAt)
}

export interface QrGenerateBody {
  partnerReferenceNo: string
  amount: { value: string; currency: 'IDR' }
  merchantId: string
  externalStoreId: string
  validUpTo: string
}

/**
 * Body Create Dynamic QR MPM. Nominal dikirim sebagai string 2 desimal
 * ("10000.00") sesuai format amount SNAP; externalStoreId memakai
 * store.id supaya ShopeePay bisa membedakan toko.
 */
export function buildQrGenerateBody(input: {
  partnerReferenceNo: string
  amount: number
  merchantId: string
  storeId: string
  validUpTo: Date
}): QrGenerateBody {
  return {
    partnerReferenceNo: input.partnerReferenceNo,
    amount: {
      value: Math.max(0, Math.floor(Number(input.amount) || 0)).toFixed(2),
      currency: 'IDR',
    },
    merchantId: input.merchantId,
    externalStoreId: input.storeId,
    validUpTo: toSnapIso(input.validUpTo),
  }
}

/** Body token B2B (grantType client_credentials). */
export function buildTokenBody(): { grantType: 'client_credentials' } {
  return { grantType: 'client_credentials' }
}

export interface QrGenerateResult {
  qrContent: string
  /** ID transaksi ShopeePay (bila dikembalikan). */
  trxId: string | null
}

/**
 * Parse respons generate QR. Sukses SNAP = responseCode diawali "200"
 * (untuk service 47: "2004700"). qrContent ada di data.qrContent.
 * Mengembalikan null bila respons bukan sukses / tidak ada qrContent —
 * pemanggil lalu jatuh ke alur manual (bukan error yang mematikan
 * checkout).
 */
export function parseQrGenerateResponse(
  json: unknown
): QrGenerateResult | null {
  if (typeof json !== 'object' || json === null) return null
  const obj = json as Record<string, unknown>
  const code = String(obj.responseCode ?? '')
  if (!code.startsWith('200')) return null
  const data = obj.data
  if (typeof data !== 'object' || data === null) return null
  const qrContent = (data as Record<string, unknown>).qrContent
  if (typeof qrContent !== 'string' || !qrContent) return null
  const trxId = (data as Record<string, unknown>).trxId
  return {
    qrContent,
    trxId: typeof trxId === 'string' ? trxId : null,
  }
}

/**
 * Parse respons inquiry status QR. Mengembalikan 'PAID' bila ShopeePay
 * menyatakan transaksi lunas (responseCode sukses + status paid), atau
 * null bila tidak bisa disimpulkan — pemanggil memakai status lokal.
 */
export function parseQrStatusResponse(json: unknown): 'PAID' | null {
  if (typeof json !== 'object' || json === null) return null
  const obj = json as Record<string, unknown>
  const code = String(obj.responseCode ?? '')
  if (!code.startsWith('200')) return null
  const data = obj.data
  if (typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>
  const status = String(d.transactionStatus ?? d.status ?? '').toUpperCase()
  if (status === 'PAID' || status === 'SUCCESS' || status === '00') return 'PAID'
  return null
}
