import { describe, expect, it } from 'vitest'
import { validateStorePayment } from '@/lib/store-payment'

const EMPTY = {
  bankName: '',
  bankAccountName: '',
  bankAccountNumber: '',
  qrisImageUrl: '',
  codEnabled: true,
}

describe('validateStorePayment', () => {
  it('semua kosong = valid (toko COD saja / QRIS dinamis saja)', () => {
    expect(validateStorePayment(EMPTY)).toBeNull()
  })

  it('trio rekening lengkap + nomor valid = valid', () => {
    expect(
      validateStorePayment({
        ...EMPTY,
        bankName: 'BCA',
        bankAccountName: 'Kopi Sore',
        bankAccountNumber: '1234567890',
      })
    ).toBeNull()
  })

  it('nomor rekening boleh berisi spasi dan tanda hubung', () => {
    expect(
      validateStorePayment({
        ...EMPTY,
        bankName: 'BRI',
        bankAccountName: 'Kopi Sore',
        bankAccountNumber: '1234-5678 90',
      })
    ).toBeNull()
  })

  it('trio setengah terisi = error', () => {
    expect(
      validateStorePayment({ ...EMPTY, bankName: 'BCA' })
    ).toMatch(/ketiga kolom rekening/)
    expect(
      validateStorePayment({
        ...EMPTY,
        bankName: 'BCA',
        bankAccountNumber: '1234567890',
      })
    ).toMatch(/ketiga kolom rekening/)
  })

  it('nomor rekening berisi huruf atau titik = error', () => {
    const base = {
      ...EMPTY,
      bankName: 'BCA',
      bankAccountName: 'Kopi Sore',
    }
    expect(
      validateStorePayment({ ...base, bankAccountNumber: '1234ABCD' })
    ).toMatch(/hanya boleh berisi angka/)
    expect(
      validateStorePayment({ ...base, bankAccountNumber: '1234.5678' })
    ).toMatch(/hanya boleh berisi angka/)
  })

  it('QRIS saja tanpa rekening = valid', () => {
    expect(
      validateStorePayment({
        ...EMPTY,
        qrisImageUrl: 'https://example.com/qris.jpg',
      })
    ).toBeNull()
  })

  it('URL QRIS tanpa skema http(s) = error', () => {
    expect(
      validateStorePayment({ ...EMPTY, qrisImageUrl: 'qris.jpg' })
    ).toMatch(/http:\/\/ atau https:\/\//)
    expect(
      validateStorePayment({ ...EMPTY, qrisImageUrl: 'ftp://x/qris.jpg' })
    ).toMatch(/http:\/\/ atau https:\/\//)
  })

  it('spasi di ujung input diabaikan saat validasi', () => {
    expect(
      validateStorePayment({
        ...EMPTY,
        bankName: '  BCA  ',
        bankAccountName: ' Kopi Sore ',
        bankAccountNumber: ' 1234567890 ',
      })
    ).toBeNull()
  })
})
