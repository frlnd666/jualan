// Error boundary segmen invoice (R-06, 2026-11-09).
'use client'

import ErrorFallback from '@/components/ErrorFallback'

export default function Error({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  reset?: () => void
  unstable_retry?: () => void
}) {
  return (
    <ErrorFallback
      error={error}
      onRetry={unstable_retry ?? reset ?? (() => window.location.reload())}
      title="Invoice tidak bisa dimuat"
      description="Maaf, ada yang tidak beres saat memuat halaman invoice ini. Coba muat ulang halaman ini."
      backHref="/"
      backLabel="Kembali ke Beranda"
    />
  )
}
