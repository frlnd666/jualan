// Konversi waktu untuk <input type="datetime-local">.
//
// Input datetime-local menghasilkan string waktu dinding TANPA zona
// waktu ("2026-11-14T19:00"). Bila string itu dikirim mentah ke server
// action, server (UTC di Vercel) membacanya sebagai UTC: jadwal yang
// penjual maksudkan sebagai 19:00 WIB tersimpan sebagai 19:00 UTC
// (= 02:00 WIB keesokan hari) — bergeser +7 jam, baik di tampilan
// maupun di jadwal aktifnya. Karena itu konversi WAJIB dilakukan di
// browser penjual, satu-satunya tempat zona waktu lokal diketahui:
//
//   localInputToIso('2026-11-14T19:00') di browser WIB
//     → '2026-11-14T12:00:00.000Z'
//
// isoToLocalInput adalah kebalikannya: mengisi nilai awal input dari
// ISO yang tersimpan, dirender dalam zona waktu lokal browser.

export function localInputToIso(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return trimmed
  return date.toISOString()
}

export function isoToLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
