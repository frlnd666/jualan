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

/**
 * Item nav PENJUAL (pemilik toko) — sumber tunggal untuk nav desktop
 * (DesktopNav) dan nav mobile (mobile-bottom-nav). Dulu daftar ini
 * tersalin di dua komponen dan nav mobile hanya memuat 6 dari 12 menu,
 * sehingga Pengiriman/Voucher/Analitik/Flash Sale/Banner/Domain terasa
 * "hilang" di HP. Sekarang keduanya membaca daftar yang sama; nav mobile
 * menampilkan 4 item utama + tombol Menu yang membuka sheet berisi
 * SELURUH item ini (lihat SELLER_MOBILE_PRIMARY_HREFS).
 */
export const SELLER_NAV_ITEMS = [
  { href: '/dashboard', label: 'Beranda' },
  { href: '/dashboard/products', label: 'Produk' },
  { href: '/dashboard/orders', label: 'Pesanan' },
  { href: '/dashboard/chat', label: 'Chat' },
  { href: '/dashboard/shipping', label: 'Pengiriman' },
  { href: '/dashboard/vouchers', label: 'Voucher' },
  { href: '/dashboard/analytics', label: 'Analitik' },
  { href: '/dashboard/flash-sales', label: 'Flash Sale' },
  { href: '/dashboard/banners', label: 'Banner' },
  { href: '/dashboard/domains', label: 'Domain' },
  { href: '/dashboard/subscription', label: 'Langganan' },
  { href: '/dashboard/settings', label: 'Pengaturan' },
] as const

/**
 * Staff (Fase 2) hanya boleh Beranda, Produk, dan Pesanan — menu lain
 * disembunyikan DAN halamannya dijaga di server (bukan hanya di nav),
 * sama di desktop maupun mobile.
 */
export const SELLER_STAFF_NAV_ITEMS = [
  { href: '/dashboard', label: 'Beranda' },
  { href: '/dashboard/products', label: 'Produk' },
  { href: '/dashboard/orders', label: 'Pesanan' },
] as const

/** Href yang selalu tampil sebagai tombol di nav bawah mobile penjual;
 *  sisanya (dari SELLER_NAV_ITEMS) dijangkau lewat tombol Menu/sheet. */
export const SELLER_MOBILE_PRIMARY_HREFS: readonly string[] = [
  '/dashboard',
  '/dashboard/products',
  '/dashboard/orders',
  '/dashboard/chat',
]

/** Item nav penjual yang aktif untuk pathname ini (prefix-match; Beranda
 *  hanya path persis), atau null bila tidak ada yang cocok. */
export function activeSellerNavHref(pathname: string): string | null {
  for (const item of SELLER_NAV_ITEMS) {
    if (item.href === '/dashboard') {
      if (pathname === '/dashboard') return item.href
    } else if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      return item.href
    }
  }
  return null
}

/**
 * True bila halaman aktif adalah menu penjual yang di mobile hanya
 * terjangkau lewat sheet Menu (bukan salah satu tombol utama nav bawah)
 * — dipakai untuk menyorot tombol Menu. False di area admin & staff
 * (staff tidak punya sheet).
 */
export function isSellerMenuSection(pathname: string): boolean {
  if (isAdminRoute(pathname)) return false
  const active = activeSellerNavHref(pathname)
  return active !== null && !SELLER_MOBILE_PRIMARY_HREFS.includes(active)
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

/**
 * Tujuan lonceng notifikasi di header dashboard: di area admin menuju
 * halaman tes notifikasi admin (/dashboard/admin/notifications — nav
 * admin), di luar itu menuju inbox notifikasi penjual
 * (/dashboard/notifications). Admin tidak menerima notifikasi in-app
 * (dispatcher hanya mengirim ke pemilik toko/staff), jadi lonceng
 * admin tidak kehilangan inbox apa pun.
 */
export function notificationHrefFor(pathname: string): string {
  return isAdminRoute(pathname)
    ? '/dashboard/admin/notifications'
    : '/dashboard/notifications'
}
