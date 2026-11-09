import { SkeletonBlock } from '@/components/ui/PageSkeleton'

export default function StorefrontLoading() {
  return (
    <div
      className="mx-auto max-w-6xl space-y-8 px-4 py-6"
      role="status"
      aria-label="Memuat toko"
    >
      <div className="space-y-3">
        <SkeletonBlock className="h-10 w-64" />
        <SkeletonBlock className="h-4 w-96 max-w-full" />
        <div className="flex gap-2">
          <SkeletonBlock className="h-9 w-24 rounded-full" />
          <SkeletonBlock className="h-9 w-24 rounded-full" />
          <SkeletonBlock className="h-9 w-24 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--surface)]"
          >
            <SkeletonBlock className="aspect-[4/3] w-full rounded-none" />
            <div className="space-y-2 p-4">
              <SkeletonBlock className="h-4 w-3/4" />
              <SkeletonBlock className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
