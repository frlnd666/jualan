// Error boundary segmen dashboard (R-06, 2026-11-09). Layout dashboard
// (header + nav) tetap tampil; hanya isi halaman yang diganti kartu ini.
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
      title="Dashboard tidak bisa dimuat"
      description="Maaf, ada yang tidak beres saat memuat halaman dashboard ini. Coba muat ulang — datamu tetap aman."
      backHref="/dashboard"
      backLabel="Kembali ke Dashboard"
    />
  )
}
