// Aturan tampil BuyerBottomNav (navigasi bawah pembeli, mobile).
//
// Tampil di halaman storefront publik: beranda, halaman toko, keranjang,
// halaman akun pembeli, dan halaman invoice/lacak pesanan.
// Sembunyi di: /dashboard (+ admin), /login, /register, /checkout,
// halaman auth lain, /owner, dan — penting — halaman detail produk,
// karena ProductDetailClient sudah punya sticky bottom bar sendiri
// (harga + "Pesan sekarang"); dua bar bawah akan bertumpuk.
//
// Catatan host: di domain custom/subdomain, halaman toko ber-path '/'
// (middleware me-rewrite ke /{slug}) dan detail produk ber-path
// '/products/{slug}' — keduanya ditangani di bawah.

const HIDDEN_PREFIXES = [
  '/dashboard',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/checkout',
  '/auth',
  '/owner',
  '/domain-tidak-dikenal',
]

// Route satu segmen yang BUKAN halaman toko (jadi nav tidak tampil).
const RESERVED_SINGLE_SEGMENT = new Set([
  'cart',
  'login',
  'register',
  'checkout',
  'track',
  'invoice',
  'akun',
  'dashboard',
  'auth',
  'owner',
  'domain-tidak-dikenal',
  'forgot-password',
  'reset-password',
  'store-id',
])

export function shouldShowBuyerNav(pathname: string): boolean {
  if (
    HIDDEN_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
  ) {
    return false
  }

  const parts = pathname.split('/').filter(Boolean)

  // Detail produk — platform: /{slug}/products/{product};
  // subdomain/custom: /products/{product}.
  if (parts.length === 3 && parts[1] === 'products') return false
  if (parts.length === 2 && parts[0] === 'products') return false

  if (parts.length === 0) return true // beranda
  if (parts[0] === 'cart' && parts.length === 1) return true
  if (parts[0] === 'akun' || parts[0] === 'invoice') return true
  // Satu segmen lain = slug toko (halaman toko).
  if (parts.length === 1 && !RESERVED_SINGLE_SEGMENT.has(parts[0])) return true

  return false
}

/**
 * Item BuyerBottomNav — 3 item, TANPA Beranda: tombol Home mengarah ke
 * landing (/) dan tidak diperlukan di nav pembeli. Ikon dipetakan di
 * komponen (lucide) berdasarkan href.
 */
export const BUYER_NAV_ITEMS = [
  { href: '/cart', label: 'Keranjang' },
  { href: '/akun/pesanan', label: 'Pesanan' },
  { href: '/akun/profil', label: 'Akun' },
] as const
