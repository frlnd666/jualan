/**
 * Escape satu sel CSV — aman dari dua hal:
 *  1. Karakter struktural (", koma, newline) → sel di-quote per RFC 4180.
 *  2. CSV formula injection: sel teks yang diawali `=`, `+`, `-`, `@`,
 *     tab, atau CR akan dieksekusi spreadsheet sebagai formula. Nama &
 *     nomor HP pembeli adalah teks bebas dari checkout, jadi awalan
 *     berbahaya dinetralkan dengan prefix apostrof (konvensi OWASP).
 */
export function csvEscape(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value)
  // Netralisasi formula hanya untuk input TEKS (nama/HP/catatan dari
  // pengguna). Nilai number dari server (total, stok) dibiarkan
  // numerik supaya kolom uang tetap bisa dijumlah spreadsheet.
  const text =
    typeof value === 'string' && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}
