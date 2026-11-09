import { SkeletonBlock, SkeletonCard } from '@/components/ui/PageSkeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-5" role="status" aria-label="Memuat dashboard">
      <div className="space-y-2">
        <SkeletonBlock className="h-8 w-56" />
        <SkeletonBlock className="h-4 w-72" />
      </div>
      <SkeletonCard>
        <SkeletonBlock className="h-5 w-40" />
        <div className="mt-4 space-y-3">
          <SkeletonBlock className="h-14 w-full" />
          <SkeletonBlock className="h-14 w-full" />
        </div>
      </SkeletonCard>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i}>
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="mt-3 h-7 w-16" />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonCard>
        <SkeletonBlock className="h-5 w-48" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-16 w-full" />
          ))}
        </div>
      </SkeletonCard>
    </div>
  )
}
