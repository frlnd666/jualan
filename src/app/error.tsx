// Error boundary root (R-06, 2026-11-09). Next.js 16 memakai prop
// `unstable_retry`; `reset` dipertahankan sebagai fallback bila masih
// disediakan runtime.
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
      title="Halaman tidak bisa dimuat"
      description="Maaf, ada yang tidak beres di sisi kami. Coba muat ulang halaman ini — biasanya langsung pulih."
      backHref="/"
      backLabel="Kembali ke Beranda"
    />
  )
}
