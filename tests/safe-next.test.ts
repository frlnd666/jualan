import { describe, expect, it } from 'vitest'
import { isSafeNextPath, safeNextPath } from '@/lib/safe-next'
import { cartTotalQty } from '@/lib/use-cart'
import { shouldShowBuyerNav } from '@/lib/buyer-nav'
import type { CartItem } from '@/lib/types'

describe('isSafeNextPath', () => {
  it('menerima path relatif same-origin', () => {
    expect(isSafeNextPath('/akun')).toBe(true)
    expect(isSafeNextPath('/kopisore/products/kopi')).toBe(true)
    expect(isSafeNextPath('/checkout')).toBe(true)
    expect(isSafeNextPath('/products/kopi?tab=1')).toBe(true)
    expect(isSafeNextPath('/')).toBe(true)
  })

  it('menolak nilai kosong / bukan path', () => {
    expect(isSafeNextPath(null)).toBe(false)
    expect(isSafeNextPath(undefined)).toBe(false)
    expect(isSafeNextPath('')).toBe(false)
    expect(isSafeNextPath('akun')).toBe(false)
    expect(isSafeNextPath('https://evil.com/akun')).toBe(false)
    expect(isSafeNextPath('javascript:alert(1)')).toBe(false)
  })

  it('menolak protocol-relative dan backslash (open redirect)', () => {
    expect(isSafeNextPath('//evil.com')).toBe(false)
    expect(isSafeNextPath('//evil.com/akun')).toBe(false)
    // URLSearchParams men-decode '/%2F%2Fevil.com' jadi '//evil.com'
    // sebelum validasi — bentuk ini harus tertolak juga.
    expect(isSafeNextPath(decodeURIComponent('/%2F%2Fevil.com'))).toBe(false)
    expect(isSafeNextPath('/\\evil.com')).toBe(false)
    expect(isSafeNextPath('/akun\\evil.com')).toBe(false)
  })

  it('menolak karakter kontrol / spasi mentah', () => {
    expect(isSafeNextPath('/akun\n/evil.com')).toBe(false)
    expect(isSafeNextPath('/akun /evil')).toBe(false)
  })
})

describe('safeNextPath', () => {
  it('mengembalikan value bila aman, fallback bila tidak', () => {
    expect(safeNextPath('/kopisore/products/kopi', '/akun')).toBe(
      '/kopisore/products/kopi'
    )
    expect(safeNextPath('//evil.com', '/akun')).toBe('/akun')
    expect(safeNextPath(null, '/dashboard')).toBe('/dashboard')
    expect(safeNextPath('https://evil.com', '/dashboard')).toBe('/dashboard')
  })
})

describe('cartTotalQty', () => {
  const item = (qty: number): CartItem =>
    ({
      product: { id: `p-${qty}`, name: 'Produk', price: 1000 },
      qty,
    }) as CartItem

  it('menjumlahkan kuantitas seluruh item', () => {
    expect(cartTotalQty([])).toBe(0)
    expect(cartTotalQty([item(2), item(3)])).toBe(5)
  })

  it('mengabaikan kuantitas tidak valid', () => {
    expect(cartTotalQty([item(2), item(-1), item(Number.NaN)])).toBe(2)
  })
})

describe('shouldShowBuyerNav', () => {
  it('tampil di beranda, toko, keranjang, akun, dan invoice', () => {
    expect(shouldShowBuyerNav('/')).toBe(true)
    expect(shouldShowBuyerNav('/kopisore')).toBe(true)
    expect(shouldShowBuyerNav('/cart')).toBe(true)
    expect(shouldShowBuyerNav('/akun/pesanan')).toBe(true)
    expect(shouldShowBuyerNav('/akun/profil')).toBe(true)
    expect(shouldShowBuyerNav('/invoice/INV-20261109-ABC')).toBe(true)
  })

  it('sembunyi di dashboard, auth, checkout, dan admin', () => {
    expect(shouldShowBuyerNav('/dashboard')).toBe(false)
    expect(shouldShowBuyerNav('/dashboard/products')).toBe(false)
    expect(shouldShowBuyerNav('/dashboard/admin')).toBe(false)
    expect(shouldShowBuyerNav('/login')).toBe(false)
    expect(shouldShowBuyerNav('/register')).toBe(false)
    expect(shouldShowBuyerNav('/checkout')).toBe(false)
    expect(shouldShowBuyerNav('/forgot-password')).toBe(false)
  })

  it('sembunyi di detail produk — bar bawah produk sudah ada di sana', () => {
    // Platform: /{slug}/products/{product}
    expect(shouldShowBuyerNav('/kopisore/products/kopi')).toBe(false)
    // Subdomain/custom: /products/{product}
    expect(shouldShowBuyerNav('/products/kopi')).toBe(false)
  })

  it('tidak tampil di route satu segmen yang bukan toko', () => {
    expect(shouldShowBuyerNav('/track')).toBe(false)
    expect(shouldShowBuyerNav('/domain-tidak-dikenal')).toBe(false)
  })
})
