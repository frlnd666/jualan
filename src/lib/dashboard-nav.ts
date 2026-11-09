// Navigasi dashboard — pemilih nav admin vs penjual/staff.
//
// Admin platform punya navbar SENDIRI (bukan item "Admin" yang ditempel
// di nav penjual): bila pathname berada di bawah /dashboard/admin,
// komponen nav menampilkan AdminMobileBottomNav / AdminDesktopNav.
// Logika pemilihnya murni (tanpa render) supaya bisa dites vitest.

/** True bila pathname berada di area admin: /dashboard/admin atau di bawahnya. */
export function isAdminRoute(pathname: string): boolean {
  return pathname === '/dashboard/admin' || pathname.startsWith('/dashboard/admin/')
}

/** Item navbar admin — urutan tampil. Ikon dipetakan di komponen nav. */
export const ADMIN_NAV_ITEMS = [
  { href: '/dashboard/admin', label: 'Dashboard' },
  { href: '/dashboard/admin/stores', label: 'Toko' },
  { href: '/dashboard/admin/subscriptions', label: 'Langganan' },
  { href: '/dashboard/admin/audit', label: 'Audit' },
  { href: '/dashboard/admin/notifications', label: 'Notifikasi' },
] as const

/**
 * Active state item nav admin: "Dashboard" aktif hanya di path persis
 * /dashboard/admin; item lain aktif bila pathname diawali href-nya
 * (mis. /dashboard/admin/stores/123 menyorot "Toko").
 */
export function isAdminNavItemActive(href: string, pathname: string): boolean {
  if (href === '/dashboard/admin') return pathname === '/dashboard/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}
