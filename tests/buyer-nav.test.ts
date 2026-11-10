import { describe, expect, it } from 'vitest'
import { storeSlugFromBuyerPathname } from '@/lib/buyer-nav'

// Audit 2026-11-10 (W-3): BuyerBottomNav mengambil tema toko dari
// slug di path — fungsi ini menentukan halaman mana yang dianggap
// halaman toko.
describe('storeSlugFromBuyerPathname', () => {
  it('mengembalikan slug untuk halaman toko satu segmen', () => {
    expect(storeSlugFromBuyerPathname('/kopisore')).toBe('kopisore')
    expect(storeSlugFromBuyerPathname('/toko-baru-123')).toBe('toko-baru-123')
  })

  it('null untuk route cadangan satu segmen', () => {
    for (const path of [
      '/cart',
      '/akun',
      '/invoice',
      '/track',
      '/login',
      '/register',
      '/checkout',
      '/dashboard',
    ]) {
      expect(storeSlugFromBuyerPathname(path), path).toBeNull()
    }
  })

  it('null untuk beranda, multi-segmen, dan domain custom (path /)', () => {
    expect(storeSlugFromBuyerPathname('/')).toBeNull()
    expect(storeSlugFromBuyerPathname('/akun/pesanan')).toBeNull()
    expect(storeSlugFromBuyerPathname('/kopisore/products/kopi')).toBeNull()
  })
})
