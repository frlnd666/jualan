import { SkeletonBlock, SkeletonCard } from '@/components/ui/PageSkeleton'

export default function InvoiceLoading() {
  return (
    <div
      className="mx-auto max-w-2xl space-y-5"
      role="status"
      aria-label="Memuat invoice"
    >
      <SkeletonCard>
        <SkeletonBlock className="h-6 w-44" />
        <SkeletonBlock className="mt-3 h-10 w-56" />
        <SkeletonBlock className="mt-3 h-4 w-64" />
      </SkeletonCard>
      <SkeletonCard>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <SkeletonBlock className="h-4 w-40" />
              <SkeletonBlock className="h-4 w-24" />
            </div>
          ))}
        </div>
      </SkeletonCard>
      <SkeletonBlock className="h-12 w-full rounded-full" />
    </div>
  )
}
