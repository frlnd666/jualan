import { describe, expect, it } from 'vitest'
import {
  ADMIN_NAV_ITEMS,
  isAdminNavItemActive,
  isAdminRoute,
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
