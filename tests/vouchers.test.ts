import { describe, expect, it } from 'vitest'
import {
  calcDiscount,
  canCreateVoucher,
  normalizeVoucherCode,
  validateVoucher,
  type VoucherLike,
} from '@/lib/vouchers'

function voucher(overrides: Partial<VoucherLike> = {}): VoucherLike {
  return {
    id: 'v1',
    store_id: 's1',
    code: 'HEMAT10',
    discount_type: 'percent',
    discount_value: 10,
    min_order: 0,
    max_uses: null,
    max_uses_per_buyer: null,
    used_count: 0,
    starts_at: null,
    ends_at: null,
    is_active: true,
    ...overrides,
  }
}

describe('normalizeVoucherCode', () => {
  it('huruf besar + tanpa spasi', () => {
    expect(normalizeVoucherCode('  hemat10 ')).toBe('HEMAT10')
  })
})

describe('calcDiscount', () => {
  it('persen dibulatkan ke bawah', () => {
    expect(calcDiscount('percent', 10, 99999)).toBe(9999)
  })
  it('persen tidak melebihi subtotal', () => {
    expect(calcDiscount('percent', 150, 10000)).toBe(10000)
  })
  it('nominal tidak melebihi subtotal', () => {
    expect(calcDiscount('fixed', 50000, 20000)).toBe(20000)
  })
  it('subtotal 0 = diskon 0', () => {
    expect(calcDiscount('percent', 10, 0)).toBe(0)
    expect(calcDiscount('fixed', 5000, 0)).toBe(0)
  })
})

describe('validateVoucher', () => {
  it('voucher aktif memberi diskon', () => {
    expect(validateVoucher(voucher(), 100000)).toEqual({ ok: true, discount: 10000 })
  })
  it('nonaktif ditolak', () => {
    const r = validateVoucher(voucher({ is_active: false }), 100000)
    expect(r.ok).toBe(false)
  })
  it('belum berlaku ditolak', () => {
    const r = validateVoucher(
      voucher({ starts_at: new Date(Date.now() + 3600_000).toISOString() }),
      100000
    )
    expect(r.ok).toBe(false)
  })
  it('kedaluwarsa ditolak', () => {
    const r = validateVoucher(
      voucher({ ends_at: new Date(Date.now() - 1000).toISOString() }),
      100000
    )
    expect(r.ok).toBe(false)
  })
  it('kuota habis ditolak', () => {
    const r = validateVoucher(voucher({ max_uses: 5, used_count: 5 }), 100000)
    expect(r.ok).toBe(false)
    expect(validateVoucher(voucher({ max_uses: 5, used_count: 4 }), 100000).ok).toBe(true)
  })
  it('di bawah minimum order ditolak', () => {
    const r = validateVoucher(voucher({ min_order: 50000 }), 49999)
    expect(r.ok).toBe(false)
    expect(r).toMatchObject({ ok: false })
  })
  it('batas per pembeli: di bawah batas lolos, mencapai batas ditolak', () => {
    const v = voucher({ max_uses_per_buyer: 1 })
    expect(validateVoucher(v, 100000, new Date(), 0).ok).toBe(true)
    const r = validateVoucher(v, 100000, new Date(), 1)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('batas per pembeli')
  })
  it('batas per pembeli null = buyerUses berapa pun lolos', () => {
    expect(
      validateVoucher(voucher(), 100000, new Date(), 99).ok
    ).toBe(true)
  })
  it('batas per pembeli 2: dua kali pakai ditolak, sekali lolos', () => {
    const v = voucher({ max_uses_per_buyer: 2 })
    expect(validateVoucher(v, 100000, new Date(), 1).ok).toBe(true)
    expect(validateVoucher(v, 100000, new Date(), 2).ok).toBe(false)
  })
})

describe('canCreateVoucher', () => {
  it('Free tidak boleh', () => {
    expect(canCreateVoucher(false, false)).toBe(false)
  })
  it('Silver aktif boleh, PAST_DUE terkunci', () => {
    expect(canCreateVoucher(true, false)).toBe(true)
    expect(canCreateVoucher(true, true)).toBe(false)
  })
})
