// Aksi per banner toko (client): aktif/nonaktif + hapus.
'use client'

import { useState, useTransition } from 'react'
import {
  toggleStoreBannerAction,
  deleteStoreBannerAction,
} from '@/lib/actions/store-banners'

export default function BannerActions({
  bannerId,
  isActive,
}: {
  bannerId: string
  isActive: boolean
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null)
            try {
              const result = await toggleStoreBannerAction(bannerId, !isActive)
              if (result.error) setMessage(result.error)
              else setMessage(result.success ?? '')
            } catch {
              // P2-13: action melempar (mis. jaringan putus) — jangan
              // biarkan error naik ke error boundary; tampilkan inline.
              setMessage('Gagal memproses banner. Periksa koneksi lalu coba lagi.')
            }
          })
        }
        className="rounded-2xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition disabled:opacity-50"
      >
        {isActive ? 'Nonaktifkan' : 'Aktifkan'}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm('Hapus banner ini?')) return
          startTransition(async () => {
            setMessage(null)
            try {
              const result = await deleteStoreBannerAction(bannerId)
              if (result.error) setMessage(result.error)
            } catch {
              // P2-13: action melempar (mis. jaringan putus) — jangan
              // biarkan error naik ke error boundary; tampilkan inline.
              setMessage('Gagal menghapus banner. Periksa koneksi lalu coba lagi.')
            }
          })
        }}
        className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition disabled:opacity-50"
      >
        Hapus
      </button>
      {message ? (
        <span className="text-xs text-[var(--text-muted)]">{message}</span>
      ) : null}
    </div>
  )
}
