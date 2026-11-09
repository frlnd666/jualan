// Global error boundary (R-06, 2026-11-09). Menggantikan root layout
// saat error terjadi di sana, jadi HARUS merender <html>/<body> sendiri
// dan TIDAK boleh mengandalkan globals.css / class Tailwind — semua
// style inline di sini.
'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  reset?: () => void
  unstable_retry?: () => void
}) {
  useEffect(() => {
    console.error('[global-error]', error)
  }, [error])

  const retry = unstable_retry ?? reset ?? (() => window.location.reload())

  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#f6f3ee',
          color: '#1f1a17',
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <p style={{ fontSize: 36, margin: 0 }} aria-hidden>
            🙏
          </p>
          <h1 style={{ fontSize: 20, margin: '16px 0 0' }}>
            Aplikasi tidak bisa dimuat
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: '#6e6259',
              margin: '8px 0 0',
            }}
          >
            Maaf, ada yang tidak beres di sisi kami. Coba muat ulang halaman
            ini.
          </p>
          {error.digest ? (
            <p style={{ fontSize: 12, color: '#6e6259' }}>
              Kode error: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={retry}
            style={{
              marginTop: 24,
              height: 44,
              padding: '0 24px',
              borderRadius: 999,
              border: 'none',
              background: '#0b6b4a',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  )
}
