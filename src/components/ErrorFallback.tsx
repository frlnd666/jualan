// Kartu fallback untuk error boundary (R-06, 2026-11-09).
// Dipakai semua error.tsx segmen (root, dashboard, invoice, storefront).
// Bukan untuk global-error.tsx — saat itu root layout tidak dirender,
// jadi global-error memakai style inline sendiri.
'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function ErrorFallback({
  error,
  onRetry,
  title,
  description,
  backHref,
  backLabel,
}: {
  error: Error & { digest?: string }
  onRetry: () => void
  title: string
  description: string
  backHref: string
  backLabel: string
}) {
  useEffect(() => {
    console.error('[error-boundary]', error)
  }, [error])

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-4xl" aria-hidden>
        🙏
      </p>
      <h1 className="mt-4 text-xl font-bold text-[var(--text)]">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
        {description}
      </p>
      {error.digest ? (
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Kode error: {error.digest}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-11 items-center rounded-full bg-[var(--primary)] px-6 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition active:scale-[0.98]"
        >
          Coba lagi
        </button>
        <Link
          href={backHref}
          className="text-sm font-semibold text-[var(--text)] underline underline-offset-4"
        >
          {backLabel}
        </Link>
      </div>
    </div>
  )
}
