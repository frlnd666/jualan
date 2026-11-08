import { describe, expect, it } from 'vitest'
import {
  buildQrGenerateBody,
  buildTokenBody,
  isQrExpired,
  parseQrGenerateResponse,
  parseQrStatusResponse,
  partnerReferenceNoFor,
  QR_EXPIRY_SECONDS,
  qrExpiryDate,
  toSnapIso,
} from '@/lib/shopeepay/payload'

describe('partnerReferenceNoFor', () => {
  it('diturunkan dari nomor invoice + percobaan', () => {
    expect(partnerReferenceNoFor('INV-20261108-ABCDEF123456', 1)).toBe(
      'CUAN-INV-20261108-ABCDEF123456-1'
    )
    expect(partnerReferenceNoFor('INV-20261108-ABCDEF123456', 2)).toBe(
      'CUAN-INV-20261108-ABCDEF123456-2'
    )
  })
  it('maksimal 64 karakter', () => {
    const ref = partnerReferenceNoFor('INV-' + 'A'.repeat(100), 1)
    expect(ref.length).toBeLessThanOrEqual(64)
  })
  it('karakter aneh diganti strip', () => {
    expect(partnerReferenceNoFor('INV/2026 1108', 1)).toBe('CUAN-INV-2026-1108-1')
  })
})

describe('buildQrGenerateBody', () => {
  it('nominal string 2 desimal + merchant + store', () => {
    const body = buildQrGenerateBody({
      partnerReferenceNo: 'CUAN-INV-1-1',
      amount: 25900,
      merchantId: 'MERCHANT1',
      storeId: 'store-uuid',
      validUpTo: new Date('2026-11-08T10:20:00Z'),
    })
    expect(body.amount).toEqual({ value: '25900.00', currency: 'IDR' })
    expect(body.merchantId).toBe('MERCHANT1')
    expect(body.externalStoreId).toBe('store-uuid')
    expect(body.validUpTo).toMatch(/\+07:00$/)
  })
})

describe('toSnapIso', () => {
  it('format WIB +07:00', () => {
    expect(toSnapIso(new Date('2026-11-08T03:00:00Z'))).toBe(
      '2026-11-08T10:00:00+07:00'
    )
  })
})

describe('qrExpiryDate / isQrExpired', () => {
  it('kedaluwarsa 1200 detik dari sekarang', () => {
    const from = new Date('2026-11-08T10:00:00Z')
    expect(qrExpiryDate(from).getTime() - from.getTime()).toBe(
      QR_EXPIRY_SECONDS * 1000
    )
  })
  it('expired bila lewat', () => {
    expect(isQrExpired('2026-11-08T10:20:00Z', new Date('2026-11-08T10:21:00Z'))).toBe(true)
    expect(isQrExpired('2026-11-08T10:20:00Z', new Date('2026-11-08T10:19:00Z'))).toBe(false)
    expect(isQrExpired(null)).toBe(false)
  })
})

describe('buildTokenBody', () => {
  it('grantType client_credentials', () => {
    expect(buildTokenBody()).toEqual({ grantType: 'client_credentials' })
  })
})

describe('parseQrGenerateResponse', () => {
  it('sukses 2004700 mengembalikan qrContent', () => {
    expect(
      parseQrGenerateResponse({
        responseCode: '2004700',
        responseMessage: 'Successful',
        data: { qrContent: '000201010212...', trxId: 'TRX1' },
      })
    ).toEqual({ qrContent: '000201010212...', trxId: 'TRX1' })
  })
  it('responseCode gagal = null', () => {
    expect(parseQrGenerateResponse({ responseCode: '4004701', data: {} })).toBeNull()
    expect(parseQrGenerateResponse({ responseCode: '2004700', data: {} })).toBeNull()
    expect(parseQrGenerateResponse(null)).toBeNull()
  })
})

describe('parseQrStatusResponse', () => {
  it('PAID dikenali', () => {
    expect(
      parseQrStatusResponse({
        responseCode: '2004800',
        data: { transactionStatus: 'PAID' },
      })
    ).toBe('PAID')
  })
  it('status lain = null', () => {
    expect(
      parseQrStatusResponse({
        responseCode: '2004800',
        data: { transactionStatus: 'PENDING' },
      })
    ).toBeNull()
    expect(parseQrStatusResponse({ responseCode: '4040000' })).toBeNull()
  })
})
