import { describe, expect, it } from 'vitest'
import {
  calcShippingCost,
  DEFAULT_WEIGHT_GRAM,
  formatWeight,
  totalWeightGrams,
} from '@/lib/shipping'

const rate = { basePrice: 10000, perKgPrice: 5000, baseWeightGram: 1000 }

describe('totalWeightGrams', () => {
  it('menjumlahkan berat x qty', () => {
    expect(
      totalWeightGrams([
        { weightGram: 250, qty: 2 },
        { weightGram: 1000, qty: 1 },
      ])
    ).toBe(1500)
  })
  it('produk tanpa berat memakai default 500 g', () => {
    expect(totalWeightGrams([{ weightGram: null, qty: 2 }])).toBe(
      2 * DEFAULT_WEIGHT_GRAM
    )
    expect(totalWeightGrams([{ qty: 1 }])).toBe(DEFAULT_WEIGHT_GRAM)
  })
  it('qty tidak valid dihitung 0', () => {
    expect(totalWeightGrams([{ weightGram: 100, qty: -3 }])).toBe(0)
  })
})

describe('calcShippingCost', () => {
  it('berat dalam batas dasar = harga dasar', () => {
    expect(calcShippingCost(rate, 1000)).toBe(10000)
    expect(calcShippingCost(rate, 500)).toBe(10000)
  })
  it('kelebihan dibulatkan ke atas per kg', () => {
    expect(calcShippingCost(rate, 1001)).toBe(15000)
    expect(calcShippingCost(rate, 2000)).toBe(15000)
    expect(calcShippingCost(rate, 2001)).toBe(20000)
    expect(calcShippingCost(rate, 3500)).toBe(25000)
  })
  it('perKg 0 = selalu harga dasar', () => {
    expect(calcShippingCost({ ...rate, perKgPrice: 0 }, 9000)).toBe(10000)
  })
  it('nilai negatif dikunci 0', () => {
    expect(calcShippingCost({ basePrice: -5, perKgPrice: -1, baseWeightGram: 1000 }, 5000)).toBe(0)
  })
})

describe('formatWeight', () => {
  it('gram di bawah 1 kg', () => {
    expect(formatWeight(500)).toBe('500 g')
  })
  it('kg dengan 1 desimal', () => {
    expect(formatWeight(1500)).toBe('1,5 kg')
    expect(formatWeight(2000)).toBe('2 kg')
  })
})
