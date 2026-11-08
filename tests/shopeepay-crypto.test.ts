import { describe, expect, it } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import {
  buildTokenStringToSign,
  buildTxStringToSign,
  decryptSecret,
  encryptSecret,
  getEncryptionKey,
  hmacSha512Hex,
  sha256Hex,
  signRsaSha256,
  verifyRsaSha256,
  verifyWebhookSignature,
} from '@/lib/shopeepay/crypto'

// Kunci enkripsi khusus tes (32 byte acak, base64). Bukan secret produksi.
process.env.SHOPEEPAY_ENCRYPTION_KEY = Buffer.from(
  '0123456789abcdef0123456789abcdef'
).toString('base64')

describe('getEncryptionKey', () => {
  it('membaca 32 byte base64', () => {
    expect(getEncryptionKey().length).toBe(32)
  })
})

describe('encryptSecret / decryptSecret', () => {
  it('round-trip mengembalikan nilai asli', () => {
    const secret = 'my-client-secret-123'
    const packed = encryptSecret(secret)
    expect(packed).not.toContain(secret)
    expect(packed.startsWith('v1:')).toBe(true)
    expect(decryptSecret(packed)).toBe(secret)
  })
  it('dua enkripsi nilai sama menghasilkan ciphertext berbeda (IV acak)', () => {
    expect(encryptSecret('sama')).not.toBe(encryptSecret('sama'))
  })
  it('ciphertext rusak gagal didekripsi', () => {
    const packed = encryptSecret('rahasia')
    const tampered = packed.slice(0, -2) + 'AA'
    expect(() => decryptSecret(tampered)).toThrow()
  })
  it('format tidak dikenal ditolak', () => {
    expect(() => decryptSecret('bukan-format')).toThrow()
  })
})

describe('sha256Hex / hmacSha512Hex', () => {
  it('sha256 dikenal', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    )
  })
  it('hmac deterministik 128 hex', () => {
    const h = hmacSha512Hex('secret', 'data')
    expect(h).toBe(hmacSha512Hex('secret', 'data'))
    expect(h).toMatch(/^[0-9a-f]{128}$/)
  })
})

describe('buildTxStringToSign', () => {
  it('format SNAP method:url:token:sha256:timestamp', () => {
    const body = '{"a":1}'
    const s = buildTxStringToSign(
      'POST',
      '/v1.0/qr/qr-mpm-generate',
      'TOKEN',
      body,
      '2026-11-08T10:00:00+07:00'
    )
    expect(s).toBe(
      `POST:/v1.0/qr/qr-mpm-generate:TOKEN:${sha256Hex(body)}:2026-11-08T10:00:00+07:00`
    )
  })
})

describe('RSA-SHA256 token signing', () => {
  it('tanda tangan terverifikasi kunci publik', () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    })
    const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
    const stringToSign = buildTokenStringToSign(
      'CLIENT1',
      '2026-11-08T10:00:00+07:00'
    )
    expect(stringToSign).toBe('CLIENT1|2026-11-08T10:00:00+07:00')
    const sig = signRsaSha256(privatePem, stringToSign)
    expect(verifyRsaSha256(publicPem, stringToSign, sig)).toBe(true)
    expect(verifyRsaSha256(publicPem, stringToSign + 'x', sig)).toBe(false)
  })
})

describe('verifyWebhookSignature', () => {
  it('signature benar lolos, yang salah ditolak', () => {
    const secret = 'client-secret'
    const stringToSign = 'POST:/v1.0/qr/notify:TOKEN:abc:2026-11-08T10:00:00+07:00'
    const good = hmacSha512Hex(secret, stringToSign)
    expect(verifyWebhookSignature(secret, stringToSign, good)).toBe(true)
    expect(verifyWebhookSignature(secret, stringToSign, '00'.repeat(64))).toBe(false)
    expect(verifyWebhookSignature('lain', stringToSign, good)).toBe(false)
  })
})
