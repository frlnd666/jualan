import { describe, expect, it } from 'vitest'
import {
  activeSellerNavHref,
  ADMIN_NAV_ITEMS,
  isAdminNavItemActive,
  isAdminRoute,
  isSellerMenuSection,
  notificationHrefFor,
  SELLER_MOBILE_PRIMARY_HREFS,
  SELLER_NAV_ITEMS,
  SELLER_STAFF_NAV_ITEMS,
} from '@/lib/dashboard-nav'
import { BUYER_NAV_ITEMS } from '@/lib/buyer-nav'

describe('isAdminRoute', () => {
  it('true di /dashboard/admin dan semua halaman di bawahnya', () => {
    expect(isAdminRoute('/dashboard/admin')).toBe(true)
    expect(isAdminRoute('/dashboard/admin/stores')).toBe(true)
    expect(isAdminRoute('/dashboard/admin/stores/abc-123')).toBe(true)
    expect(isAdminRoute('/dashboard/admin/subscriptions')).toBe(true)
    expect(isAdminRoute('/dashboard/admin/audit')).toBe(true)
    expect(isAdminRoute('/dashboard/admin/notifications')).toBe(true)
  })

  it('false di luar area admin', () => {
    expect(isAdminRoute('/dashboard')).toBe(false)
    expect(isAdminRoute('/dashboard/products')).toBe(false)
    expect(isAdminRoute('/dashboard/orders')).toBe(false)
    expect(isAdminRoute('/dashboard/subscription')).toBe(false)
    expect(isAdminRoute('/dashboard/settings')).toBe(false)
    // Jebakan prefix: mirip tapi bukan area admin.
    expect(isAdminRoute('/dashboard/adminx')).toBe(false)
    expect(isAdminRoute('/dashboard/administrator')).toBe(false)
  })
})

describe('ADMIN_NAV_ITEMS', () => {
  it('5 item admin dengan href dan urutan yang benar', () => {
    expect(ADMIN_NAV_ITEMS.map((i) => i.href)).toEqual([
      '/dashboard/admin',
      '/dashboard/admin/stores',
      '/dashboard/admin/subscriptions',
      '/dashboard/admin/audit',
      '/dashboard/admin/notifications',
    ])
    expect(ADMIN_NAV_ITEMS.map((i) => i.label)).toEqual([
      'Dashboard',
      'Toko',
      'Langganan',
      'Audit',
      'Notifikasi',
    ])
  })
})

describe('isAdminNavItemActive', () => {
  it('"Dashboard" aktif hanya di path persis', () => {
    expect(isAdminNavItemActive('/dashboard/admin', '/dashboard/admin')).toBe(true)
    expect(isAdminNavItemActive('/dashboard/admin', '/dashboard/admin/stores')).toBe(false)
    expect(
      isAdminNavItemActive('/dashboard/admin', '/dashboard/admin/notifications')
    ).toBe(false)
  })

  it('item lain aktif prefix-match termasuk halaman detail', () => {
    expect(isAdminNavItemActive('/dashboard/admin/stores', '/dashboard/admin/stores')).toBe(true)
    expect(
      isAdminNavItemActive('/dashboard/admin/stores', '/dashboard/admin/stores/abc-123')
    ).toBe(true)
    expect(
      isAdminNavItemActive('/dashboard/admin/subscriptions', '/dashboard/admin/subscriptions')
    ).toBe(true)
    expect(isAdminNavItemActive('/dashboard/admin/audit', '/dashboard/admin/audit')).toBe(true)
    expect(
      isAdminNavItemActive('/dashboard/admin/notifications', '/dashboard/admin/notifications')
    ).toBe(true)
  })

  it('tidak aktif di halaman admin lain', () => {
    expect(isAdminNavItemActive('/dashboard/admin/stores', '/dashboard/admin/audit')).toBe(false)
    expect(
      isAdminNavItemActive('/dashboard/admin/notifications', '/dashboard/admin')
    ).toBe(false)
  })
})

describe('notificationHrefFor', () => {
  it('di area admin → halaman tes notifikasi admin', () => {
    expect(notificationHrefFor('/dashboard/admin')).toBe(
      '/dashboard/admin/notifications'
    )
    expect(notificationHrefFor('/dashboard/admin/stores')).toBe(
      '/dashboard/admin/notifications'
    )
    expect(notificationHrefFor('/dashboard/admin/audit')).toBe(
      '/dashboard/admin/notifications'
    )
  })

  it('di luar area admin → inbox notifikasi penjual', () => {
    expect(notificationHrefFor('/dashboard')).toBe('/dashboard/notifications')
    expect(notificationHrefFor('/dashboard/products')).toBe(
      '/dashboard/notifications'
    )
    expect(notificationHrefFor('/dashboard/adminx')).toBe(
      '/dashboard/notifications'
    )
  })
})

describe('SELLER_NAV_ITEMS', () => {
  it('12 menu penjual dengan href dan urutan yang sama seperti desktop', () => {
    expect(SELLER_NAV_ITEMS.map((i) => i.href)).toEqual([
      '/dashboard',
      '/dashboard/products',
      '/dashboard/orders',
      '/dashboard/chat',
      '/dashboard/shipping',
      '/dashboard/vouchers',
      '/dashboard/analytics',
      '/dashboard/flash-sales',
      '/dashboard/banners',
      '/dashboard/domains',
      '/dashboard/subscription',
      '/dashboard/settings',
    ])
    expect(SELLER_NAV_ITEMS.map((i) => i.label)).toEqual([
      'Beranda',
      'Produk',
      'Pesanan',
      'Chat',
      'Pengiriman',
      'Voucher',
      'Analitik',
      'Flash Sale',
      'Banner',
      'Domain',
      'Langganan',
      'Pengaturan',
    ])
    expect(new Set(SELLER_NAV_ITEMS.map((i) => i.href)).size).toBe(12)
  })

  it('staff hanya 3 menu pertama (Beranda, Produk, Pesanan)', () => {
    expect(SELLER_STAFF_NAV_ITEMS.map((i) => i.href)).toEqual([
      '/dashboard',
      '/dashboard/products',
      '/dashboard/orders',
    ])
  })

  it('paritas mobile: setiap menu adalah tombol utama ATAU terjangkau sheet Menu', () => {
    expect(SELLER_MOBILE_PRIMARY_HREFS).toEqual([
      '/dashboard',
      '/dashboard/products',
      '/dashboard/orders',
      '/dashboard/chat',
    ])
    // Tombol utama harus bagian dari daftar menu (tidak ada href yatim),
    // dan sheet menampilkan SELLER_NAV_ITEMS utuh — jadi cakupannya 12/12.
    for (const href of SELLER_MOBILE_PRIMARY_HREFS) {
      expect(SELLER_NAV_ITEMS.map((i) => i.href)).toContain(href)
    }
    expect(SELLER_NAV_ITEMS.length - SELLER_MOBILE_PRIMARY_HREFS.length).toBe(8)
  })
})

describe('activeSellerNavHref / isSellerMenuSection', () => {
  it('Beranda hanya aktif di path persis; item lain prefix-match', () => {
    expect(activeSellerNavHref('/dashboard')).toBe('/dashboard')
    expect(activeSellerNavHref('/dashboard/products')).toBe('/dashboard/products')
    expect(activeSellerNavHref('/dashboard/products/baru')).toBe('/dashboard/products')
    expect(activeSellerNavHref('/dashboard/domains')).toBe('/dashboard/domains')
    expect(activeSellerNavHref('/dashboard/admin')).toBeNull()
    expect(activeSellerNavHref('/dashboard/tidak-ada')).toBeNull()
  })

  it('menu section = menu non-utama (dulu tidak terjangkau di mobile)', () => {
    for (const p of [
      '/dashboard/shipping',
      '/dashboard/vouchers',
      '/dashboard/analytics',
      '/dashboard/flash-sales',
      '/dashboard/banners',
      '/dashboard/domains',
      '/dashboard/subscription',
      '/dashboard/settings',
    ]) {
      expect(isSellerMenuSection(p)).toBe(true)
    }
    expect(isSellerMenuSection('/dashboard/domains/custom')).toBe(true)
  })

  it('bukan menu section: tombol utama, area admin, dan halaman non-menu', () => {
    for (const p of [
      '/dashboard',
      '/dashboard/products',
      '/dashboard/orders',
      '/dashboard/chat',
      '/dashboard/admin',
      '/dashboard/admin/stores',
      '/dashboard/notifications',
      '/dashboard/onboarding',
    ]) {
      expect(isSellerMenuSection(p)).toBe(false)
    }
  })
})

describe('BUYER_NAV_ITEMS', () => {
  it('3 item, TANPA Beranda (/) — Home mengarah ke landing', () => {
    expect(BUYER_NAV_ITEMS.map((i) => i.href)).toEqual([
      '/cart',
      '/akun/pesanan',
      '/akun/profil',
    ])
    expect(BUYER_NAV_ITEMS.map((i) => i.label)).toEqual([
      'Keranjang',
      'Pesanan',
      'Akun',
    ])
    expect(BUYER_NAV_ITEMS.map((i) => i.href)).not.toContain('/')
  })
})
