/** Helper berbagi (share) — murni, tanpa akses browser, supaya bisa dites.
 *
 * Pola: navigator.share bila tersedia (HP), kalau tidak salin tautan
 * ke clipboard. Semua teks/tautan diisi dari data asli (nama produk /
 * toko + URL halaman yang sedang dibuka), bukan placeholder.
 */

/** Gabung origin + path relatif menjadi URL absolut yang bisa dibagikan. */
export function buildShareUrl(origin: string, path: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '')
  if (!path) return cleanOrigin
  return path.startsWith('http://') || path.startsWith('https://')
    ? path
    : `${cleanOrigin}${path.startsWith('/') ? path : `/${path}`}`
}

/** Teks berbagi untuk satu produk: nama + harga tampil (Rp). */
export function productShareText(name: string, displayPrice: number): string {
  const price = Number(displayPrice ?? 0)
  const formatted = Number.isNaN(price) ? '0' : price.toLocaleString('id-ID')
  return `${name} — Rp ${formatted}`
}

/** Teks berbagi untuk toko: nama + deskripsi singkat bila ada. */
export function storeShareText(name: string, description?: string | null): string {
  const clean = (description ?? '').trim()
  return clean ? `${name} — ${clean}` : name
}
