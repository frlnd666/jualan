/**
 * Penyamaran data pribadi customer untuk halaman publik (invoice/tracking).
 * Data lengkap hanya tampil di dashboard owner yang sudah login.
 */

/** "Budi Santoso" -> "Budi S." */
export function maskCustomerName(name: string | null | undefined) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '-'
  if (parts.length === 1) return parts[0]
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() || ''
  return `${parts[0]} ${lastInitial}.`
}

/** "6281234567890" -> "6281****7890" */
export function maskPhoneNumber(phone: string | null | undefined) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length < 8) return digits ? '****' : '-'
  return `${digits.slice(0, 4)}****${digits.slice(-4)}`
}

/** Alamat publik hanya sampai kota/provinsi/kode pos — tanpa nama jalan & nomor rumah. */
export function publicAddressLine(order: {
  city?: string | null
  province?: string | null
  postal_code?: string | null
}) {
  const city = order.city?.trim() || ''
  const province = order.province?.trim() || ''
  const postal = order.postal_code?.trim() || ''
  const main = [city, province].filter(Boolean).join(', ')
  return [main, postal].filter(Boolean).join(' ') || '-'
}
