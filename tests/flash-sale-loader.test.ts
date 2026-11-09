import { describe, expect, it } from 'vitest'
import { loadActiveFlashSalesForStore } from '@/lib/actions/flash-sales'

// Audit 2026-11-10 (W-8): dua flash sale aktif untuk produk yang sama
// harus deterministik — yang starts_at terbaru menang (sama seperti
// halaman produk), bukan urutan hasil query DB.
function fakeSupabase(rows: unknown[]) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
      resolve({ data: rows, error: null }),
  }
  return {
    from: () => chain,
  } as never
}

const NOW = new Date('2026-11-10T05:00:00Z')
const base = {
  product_id: 'p1',
  is_active: true,
  ends_at: '2026-11-10T10:00:00Z',
}

describe('loadActiveFlashSalesForStore — pemenang deterministik', () => {
  it('starts_at terbaru menang, apa pun urutan baris dari DB', async () => {
    const older = {
      ...base,
      promo_price: 9000,
      starts_at: '2026-11-10T01:00:00Z',
    }
    const newer = {
      ...base,
      promo_price: 7000,
      starts_at: '2026-11-10T03:00:00Z',
    }
    const a = await loadActiveFlashSalesForStore(
      fakeSupabase([older, newer]),
      'store-1',
      NOW
    )
    const b = await loadActiveFlashSalesForStore(
      fakeSupabase([newer, older]),
      'store-1',
      NOW
    )
    expect(a.get('p1')).toBe(7000)
    expect(b.get('p1')).toBe(7000)
  })

  it('flash sale di luar jendela waktu diabaikan', async () => {
    const future = {
      ...base,
      promo_price: 5000,
      starts_at: '2026-11-10T08:00:00Z',
    }
    const map = await loadActiveFlashSalesForStore(
      fakeSupabase([future]),
      'store-1',
      NOW
    )
    expect(map.size).toBe(0)
  })
})
