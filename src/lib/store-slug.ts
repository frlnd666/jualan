/**
 * Validasi slug toko. Slug adalah path publik (`/{slug}`), jadi tidak boleh
 * bertabrakan dengan route bawaan aplikasi dan hanya boleh berisi huruf
 * kecil, angka, dan tanda hubung tunggal di tengah.
 */
export const RESERVED_STORE_SLUGS = new Set([
  'login',
  'register',
  'dashboard',
  'cart',
  'checkout',
  'invoice',
  'track',
  'api',
  'auth',
  'store-id',
  'forgot-password',
  'reset-password',
  '_next',
  'favicon.ico',
])

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function normalizeStoreSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Kembalikan pesan error Bahasa Indonesia, atau null bila slug valid. */
export function validateStoreSlug(slug: string): string | null {
  if (!slug) return 'Slug toko wajib diisi.'
  if (slug.length < 3) return 'Slug toko minimal 3 karakter.'
  if (slug.length > 40) return 'Slug toko maksimal 40 karakter.'
  if (!SLUG_PATTERN.test(slug)) {
    return 'Slug hanya boleh huruf kecil, angka, dan tanda hubung (tidak di awal/akhir).'
  }
  if (RESERVED_STORE_SLUGS.has(slug)) {
    return 'Slug ini dipakai sistem dan tidak bisa digunakan. Pilih slug lain.'
  }
  return null
}
