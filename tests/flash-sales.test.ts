import { describe, expect, it } from 'vitest'
import {
  activeFlashSaleForProduct,
  canCreateFlashSale,
  discountPercent,
  effectivePrice,
  flashSaleRemainingMs,
  formatFlashRemaining,
  isFlashSaleActive,
  type FlashSaleLike,
} from '@/lib/flash-sales'

function sale(overrides: Partial<FlashSaleLike> = {}): FlashSaleLike {
  return {
    id: 'fs1',
    store_id: 's1',
    product_id: 'p1',
    promo_price: 15000,
    starts_at: '2026-11-09T00:00:00.000Z',
    ends_at: '2026-11-11T00:00:00.000Z',
    is_active: true,
    ...overrides,
  }
}

const NOW = new Date('2026-11-10T12:00:00.000Z')

describe('isFlashSaleActive', () => {
  it('aktif di dalam jadwal', () => {
    expect(isFlashSaleActive(sale(), NOW)).toBe(true)
  })
  it('tidak aktif sebelum mulai', () => {
    expect(
      isFlashSaleActive(sale(), new Date('2026-11-08T12:00:00.000Z'))
    ).toBe(false)
  })
  it('tidak aktif setelah berakhir', () => {
    expect(
      isFlashSaleActive(sale(), new Date('2026-11-12T00:00:00.000Z'))
    ).toBe(false)
  })
  it('tidak aktif bila dimatikan manual', () => {
    expect(isFlashSaleActive(sale({ is_active: false }), NOW)).toBe(false)
  })
})

describe('effectivePrice', () => {
  it('pakai harga promo saat flash sale aktif', () => {
    expect(effectivePrice(25000, sale(), NOW)).toBe(15000)
  })
  it('harga normal bila tidak ada flash sale', () => {
    expect(effectivePrice(25000, null, NOW)).toBe(25000)
  })
  it('harga normal bila promo >= harga normal', () => {
    expect(effectivePrice(10000, sale({ promo_price: 15000 }), NOW)).toBe(10000)
  })
  it('harga normal bila flash sale sudah berakhir', () => {
    expect(
      effectivePrice(25000, sale(), new Date('2026-11-12T00:00:00.000Z'))
    ).toBe(25000)
  })
})

describe('activeFlashSaleForProduct', () => {
  it('memilih yang aktif untuk produk itu', () => {
    const sales = [
      sale({ id: 'a', product_id: 'p2' }),
      sale({ id: 'b', product_id: 'p1', is_active: false }),
      sale({ id: 'c', product_id: 'p1' }),
    ]
    expect(activeFlashSaleForProduct(sales, 'p1', NOW)?.id).toBe('c')
  })
  it('null bila tidak ada yang aktif', () => {
    expect(activeFlashSaleForProduct([sale({ is_active: false })], 'p1', NOW)).toBeNull()
  })
})

describe('discountPercent', () => {
  it('40% dari 25000 ke 15000', () => {
    expect(discountPercent(25000, 15000)).toBe(40)
  })
  it('0 bila promo >= normal', () => {
    expect(discountPercent(10000, 10000)).toBe(0)
  })
})

describe('formatFlashRemaining', () => {
  it('menit', () => {
    expect(formatFlashRemaining(45 * 60 * 1000)).toBe('45m lagi')
  })
  it('jam + menit', () => {
    expect(formatFlashRemaining((2 * 60 + 15) * 60 * 1000)).toBe('2j 15m lagi')
  })
  it('hari', () => {
    expect(formatFlashRemaining(3 * 24 * 60 * 60 * 1000)).toBe('3 hari lagi')
  })
  it('berakhir', () => {
    expect(formatFlashRemaining(0)).toBe('Berakhir')
    expect(flashSaleRemainingMs(sale(), new Date('2026-11-12T00:00:00.000Z'))).toBe(0)
  })
})

describe('canCreateFlashSale', () => {
  it('Silver/Gold boleh, Free tidak', () => {
    expect(canCreateFlashSale(true, false)).toBe(true)
    expect(canCreateFlashSale(false, false)).toBe(false)
  })
  it('PAST_DUE mengunci', () => {
    expect(canCreateFlashSale(true, true)).toBe(false)
  })
})
