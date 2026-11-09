/**
 * Kerangka loading bersama (audit 2026-11-09): sebelum ini TIDAK ADA
 * satu pun loading.tsx di aplikasi — halaman server (dashboard, akun,
 * storefront, invoice) menggantung tanpa umpan balik di koneksi
 * lambat. Blok animate-pulse memakai geometri kartu yang sama dengan
 * permukaan aslinya supaya layout tidak melompat saat data tiba.
 */
export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-2xl bg-[var(--surface-soft)] ${className}`}
    />
  )
}

export function SkeletonCard({ children }: { children?: React.ReactNode }) {
  return (
    <div className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
      {children}
    </div>
  )
}

/** Skeleton daftar kartu generik (akun, pesanan, dsb.). */
export function ListPageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mx-auto max-w-2xl space-y-5" role="status" aria-label="Memuat">
      <div className="space-y-2">
        <SkeletonBlock className="h-8 w-48" />
        <SkeletonBlock className="h-4 w-64" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonCard key={i}>
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-12 w-12 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock className="h-4 w-2/3" />
              <SkeletonBlock className="h-3 w-1/3" />
            </div>
            <SkeletonBlock className="h-6 w-20" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  )
}
