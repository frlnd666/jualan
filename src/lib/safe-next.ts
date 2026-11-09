// Validasi `next` untuk redirect pasca-auth — anti open-redirect.
//
// Aturan: hanya path relatif same-origin yang diizinkan.
//  - harus diawali '/'
//  - tidak boleh '//' (protocol-relative, mis. //evil.com)
//  - tidak boleh mengandung backslash (browser bisa menormalkannya
//    jadi '/' — '/\evil.com' lolos dari cek '//' yang naif)
//  - tidak boleh mengandung karakter kontrol / spasi mentah
// Query string dan hash di dalam path tetap diizinkan
// (mis. '/toko/produk?tab=1') karena tetap same-origin.
//
// Catatan: URLSearchParams sudah men-decode nilai sebelum sampai ke
// sini, jadi bentuk ter-encode seperti '/%2F%2Fevil.com' sudah
// berubah jadi '//evil.com' dan tertolak oleh cek di bawah.
export function isSafeNextPath(value: string | null | undefined): value is string {
  if (!value) return false
  if (!value.startsWith('/')) return false
  if (value.startsWith('//')) return false
  if (value.includes('\\')) return false
  if (/[\u0000-\u0020\u007f]/.test(value)) return false
  return true
}

/** Kembalikan `value` bila aman, atau `fallback` (mis. '/dashboard'). */
export function safeNextPath(
  value: string | null | undefined,
  fallback: string
): string {
  return isSafeNextPath(value) ? value : fallback
}
