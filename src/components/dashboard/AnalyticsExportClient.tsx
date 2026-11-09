// Tombol export CSV analitik (client) — server action mengembalikan
// string CSV, lalu diunduh sebagai file lewat Blob (tanpa endpoint baru).
'use client'

import { useState, useTransition } from 'react'
import { exportAnalyticsCsvAction } from '@/lib/actions/analytics'
import type { AnalyticsRange } from '@/lib/analytics'

export default function AnalyticsExportClient({
  range,
  canExport,
}: {
  range: AnalyticsRange
  canExport: boolean
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleExport() {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await exportAnalyticsCsvAction(range)
        if (!result.success) {
          setMessage(result.error)
          return
        }
        const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = result.filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        setMessage('File CSV terunduh.')
      } catch {
        // P2-13: action melempar (mis. jaringan putus) — jangan biarkan
        // error naik ke error boundary; tampilkan inline.
        setMessage('Gagal menyiapkan file CSV. Periksa koneksi lalu coba lagi.')
      }
    })
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleExport}
        disabled={!canExport || isPending}
        className="rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? 'Menyiapkan…' : 'Export CSV (Gold)'}
      </button>
      {message ? (
        <span className="text-xs text-[var(--text-muted)]">{message}</span>
      ) : null}
    </span>
  )
}
