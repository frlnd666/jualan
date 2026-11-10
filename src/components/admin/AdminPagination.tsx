// Pagination server-side untuk area admin: tautan ?page= biasa
// (tanpa JS), parameter query lain (q, action, …) dipertahankan.
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface AdminPaginationProps {
  basePath: string
  page: number
  pageCount: number
  total: number
  /** Parameter query yang harus ikut di setiap tautan (selain page). */
  params?: Record<string, string | undefined>
  /** Label benda yang dihitung, mis. "toko" / "pembayaran" / "log". */
  unitLabel: string
}

function buildHref(
  basePath: string,
  params: Record<string, string | undefined> | undefined,
  page: number
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) search.set(key, value)
  }
  if (page > 1) search.set('page', String(page))
  const qs = search.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

export default function AdminPagination({
  basePath,
  page,
  pageCount,
  total,
  params,
  unitLabel,
}: AdminPaginationProps) {
  if (total === 0) return null
  // Audit 2026-11-10: target sentuh diperbesar (min-h 40px) + nav
  // berlabel supaya terbedakan dari navigasi lain oleh pembaca layar.
  const linkClass =
    'inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--surface-soft)]'
  const disabledClass =
    'inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)] opacity-60'
  return (
    <nav
      aria-label={`Pagination ${unitLabel}`}
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-xs text-[var(--text-muted)]">
        {total} {unitLabel} • Halaman {page} dari {pageCount}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={buildHref(basePath, params, page - 1)} className={linkClass}>
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            Sebelumnya
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled>
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            Sebelumnya
          </span>
        )}
        {page < pageCount ? (
          <Link href={buildHref(basePath, params, page + 1)} className={linkClass}>
            Berikutnya
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled>
            Berikutnya
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
      </div>
    </nav>
  )
}
