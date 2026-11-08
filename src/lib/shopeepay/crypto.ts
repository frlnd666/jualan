// Crypto ShopeePay SNAP — SERVER-ONLY (node:crypto).
// JANGAN diimpor dari Client Component atau dari kode yang dibundel ke
// browser: file ini membaca SHOPEEPAY_ENCRYPTION_KEY (server env) dan
// menandatangani request dengan private key toko.
//
// Dua hal terpisah di sini:
//   1. Enkripsi kredensial toko (AES-256-GCM) untuk disimpan di
//      store_shopeepay_credentials — nilai asli secret TIDAK PERNAH
//      masuk database.
//   2. Signing SNAP (Standar Nasional Open API Pembayaran):
//      - token B2B: RSA-SHA256 atas `clientId|timestamp`;
//      - request transaksional: HMAC-SHA512 atas stringToSign
//        method:relativeUrl:accessToken:sha256(body):timestamp.

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  createSign,
  createVerify,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

const ENC_VERSION = 'v1'

/**
 * Kunci enkripsi platform dari env SHOPEEPAY_ENCRYPTION_KEY.
 * Diterima: base64 32 byte (44 karakter) atau hex 64 karakter.
 * Bila env belum diisi, error-nya eksplisit — generate QRIS dinamis
 * tidak boleh jalan tanpa kunci ini.
 */
export function getEncryptionKey(): Buffer {
  const raw = (process.env.SHOPEEPAY_ENCRYPTION_KEY || '').trim()
  if (!raw) {
    throw new Error(
      'SHOPEEPAY_ENCRYPTION_KEY belum diisi di environment server. ' +
        'Isi dengan 32 byte acak (base64/hex) sebelum menyimpan kredensial ShopeePay.'
    )
  }
  let key: Buffer
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex')
  } else {
    key = Buffer.from(raw, 'base64')
  }
  if (key.length !== 32) {
    throw new Error(
      'SHOPEEPAY_ENCRYPTION_KEY tidak valid: harus 32 byte (base64 44 karakter atau hex 64 karakter).'
    )
  }
  return key
}

/**
 * Enkripsi satu secret toko. Format:
 * `v1:<iv base64>:<ciphertext base64>:<auth tag base64>`.
 */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [
    ENC_VERSION,
    iv.toString('base64'),
    ciphertext.toString('base64'),
    tag.toString('base64'),
  ].join(':')
}

/** Dekripsi nilai hasil encryptSecret. Gagal = error (bukan null). */
export function decryptSecret(packed: string): string {
  const parts = packed.split(':')
  if (parts.length !== 4 || parts[0] !== ENC_VERSION) {
    throw new Error('Format kredensial terenkripsi tidak dikenal.')
  }
  const key = getEncryptionKey()
  const iv = Buffer.from(parts[1], 'base64')
  const ciphertext = Buffer.from(parts[2], 'base64')
  const tag = Buffer.from(parts[3], 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}

export function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex')
}

export function hmacSha512Hex(secret: string, data: string): string {
  return createHmac('sha512', secret).update(data, 'utf8').digest('hex')
}

/** String yang ditandatangani untuk token B2B: `clientId|timestamp`. */
export function buildTokenStringToSign(clientId: string, timestamp: string): string {
  return `${clientId}|${timestamp}`
}

/** Tanda tangan RSA-SHA256 (base64) memakai private key PEM toko. */
export function signRsaSha256(privateKeyPem: string, stringToSign: string): string {
  const signer = createSign('RSA-SHA256')
  signer.update(stringToSign, 'utf8')
  signer.end()
  return signer.sign(privateKeyPem, 'base64')
}

/**
 * StringToSign request transaksional SNAP:
 * method:relativeUrl:accessToken:sha256Hex(minified body):timestamp.
 * Body harus sudah di-minify (JSON.stringify tanpa spasi).
 */
export function buildTxStringToSign(
  method: string,
  relativeUrl: string,
  accessToken: string,
  minifiedBody: string,
  timestamp: string
): string {
  return [
    method.toUpperCase(),
    relativeUrl,
    accessToken,
    sha256Hex(minifiedBody),
    timestamp,
  ].join(':')
}

/** Tanda tangan HMAC-SHA512 untuk request transaksional. */
export function signTxHmacSha512(
  clientSecret: string,
  stringToSign: string
): string {
  return hmacSha512Hex(clientSecret, stringToSign)
}

/**
 * Verifikasi signature webhook ShopeePay (HMAC-SHA512, hex).
 * Perbandingan timing-safe; panjang berbeda = tidak valid.
 */
export function verifyWebhookSignature(
  clientSecret: string,
  stringToSign: string,
  signatureHex: string
): boolean {
  const expected = Buffer.from(hmacSha512Hex(clientSecret, stringToSign), 'utf8')
  const actual = Buffer.from((signatureHex || '').trim(), 'utf8')
  if (expected.length !== actual.length) return false
  try {
    return timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

/** Verifikasi tanda tangan RSA-SHA256 (dipakai di tes). */
export function verifyRsaSha256(
  publicKeyPem: string,
  stringToSign: string,
  signatureBase64: string
): boolean {
  const verifier = createVerify('RSA-SHA256')
  verifier.update(stringToSign, 'utf8')
  verifier.end()
  return verifier.verify(publicKeyPem, signatureBase64, 'base64')
}
