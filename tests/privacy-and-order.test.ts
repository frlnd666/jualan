import { describe, expect, it } from 'vitest'
import {
  maskCustomerName,
  maskPhoneNumber,
  publicAddressLine,
} from '@/lib/utils/privacy'
import {
  calculateSubtotal,
  calculateOrderTotal,
  normalizePhoneNumber,
} from '@/lib/utils/order'

describe('maskCustomerName', () => {
  it('menyamarkan nama belakang menjadi inisial', () => {
    expect(maskCustomerName('Budi Santoso')).toBe('Budi S.')
    expect(maskCustomerName('Siti Nur Haliza')).toBe('Siti H.')
  })
  it('nama satu kata tetap utuh, kosong menjadi strip', () => {
    expect(maskCustomerName('Budi')).toBe('Budi')
    expect(maskCustomerName('')).toBe('-')
    expect(maskCustomerName(null)).toBe('-')
  })
})

describe('maskPhoneNumber', () => {
  it('menyisakan 4 digit awal dan akhir', () => {
    expect(maskPhoneNumber('6281234567890')).toBe('6281****7890')
    expect(maskPhoneNumber('0812-3456-7890')).toBe('0812****7890')
  })
  it('nomor pendek disamarkan penuh', () => {
    expect(maskPhoneNumber('12345')).toBe('****')
    expect(maskPhoneNumber('')).toBe('-')
  })
})

describe('publicAddressLine', () => {
  it('hanya kota, provinsi, kode pos — tanpa alamat jalan', () => {
    expect(
      publicAddressLine({ city: 'Depok', province: 'Jawa Barat', postal_code: '16424' })
    ).toBe('Depok, Jawa Barat 16424')
  })
})

describe('normalizePhoneNumber', () => {
  it('mengubah awalan 0 menjadi 62 dan membuang non-digit', () => {
    expect(normalizePhoneNumber('0812-3456-7890')).toBe('6281234567890')
    expect(normalizePhoneNumber('+62 812 3456 7890')).toBe('6281234567890')
    expect(normalizePhoneNumber('6281234567890')).toBe('6281234567890')
  })
  it('TIDAK hanya membuang huruf D (regresi bug regex lama)', () => {
    expect(normalizePhoneNumber('D0812')).toBe('62812')
  })
})

describe('kalkulasi order', () => {
  it('subtotal dan total konsisten', () => {
    expect(
      calculateSubtotal([
        { price: 10000, qty: 2 },
        { price: 5000, qty: 1 },
      ] as never)
    ).toBe(25000)
    expect(calculateOrderTotal(25000, 9000)).toBe(34000)
  })
})
