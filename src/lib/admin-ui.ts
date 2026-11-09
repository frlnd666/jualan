// Helper tampilan area admin platform (Fase 2+) — fungsi MURNI.
// Redesign admin 2026-11-10: pagination server-side (?page=) untuk
// daftar toko / riwayat pembayaran / log audit, dan label + warna
// pill status yang konsisten di semua halaman admin (sebelumnya teks
// status mentah seperti "gold • TRIALING" tampil apa adanya).

export const ADMIN_PAGE_SIZE = 20

export interface PageInfo {
  /** Halaman aktif, sudah diklem ke rentang valid (mulai dari 1). */
  page: number
  pageCount: number
  total: number
  /** Indeks baris pertama halaman ini (0-based, untuk .range()). */
  from: number
  /** Indeks baris terakhir halaman ini (inklusif, untuk .range()). */
  to: number
}

export function paginate(
  total: number,
  rawPage: unknown,
  pageSize: number = ADMIN_PAGE_SIZE
): PageInfo {
  const safeTotal = Math.max(0, Math.floor(Number(total) || 0))
  const pageCount = Math.max(1, Math.ceil(safeTotal / pageSize))
  const parsed = Math.floor(Number(rawPage))
  const page = Number.isFinite(parsed)
    ? Math.min(pageCount, Math.max(1, parsed))
    : 1
  const from = (page - 1) * pageSize
  const to = Math.min(safeTotal - 1, from + pageSize - 1)
  return { page, pageCount, total: safeTotal, from, to }
}

/** Label status pembayaran langganan untuk admin. */
export function paymentStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING_VERIFICATION':
      return 'Menunggu verifikasi'
    case 'VERIFIED':
      return 'Terverifikasi'
    case 'REJECTED':
      return 'Ditolak'
    default:
      return status
  }
}

export function paymentStatusPillClass(status: string): string {
  switch (status) {
    case 'PENDING_VERIFICATION':
      return 'bg-amber-100 text-amber-800'
    case 'VERIFIED':
      return 'bg-emerald-100 text-emerald-700'
    case 'REJECTED':
      return 'bg-rose-100 text-rose-700'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}

/** Warna pill status langganan toko (labelnya dari STATUS_LABELS). */
export function subscriptionStatusPillClass(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-100 text-emerald-700'
    case 'TRIALING':
      return 'bg-sky-100 text-sky-700'
    case 'PAST_DUE':
      return 'bg-amber-100 text-amber-800'
    case 'SUSPENDED':
      return 'bg-rose-100 text-rose-700'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}

/** Warna aksen nama tier pada pill gabungan tier + status. */
export function tierPillClass(tier: string): string {
  switch (tier) {
    case 'gold':
      return 'bg-yellow-100 text-yellow-800'
    case 'silver':
      return 'bg-slate-200 text-slate-700'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}
