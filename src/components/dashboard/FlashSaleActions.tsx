// Aksi per flash sale (client): aktif/nonaktif + hapus.
'use client'

import { useState, useTransition } from 'react'
import {
  toggleFlashSaleAction,
  deleteFlashSaleAction,
} from '@/lib/actions/flash-sales'

export default function FlashSaleActions({
  saleId,
  isActive,
}: {
  saleId: string
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
            const result = await toggleFlashSaleAction(saleId, !isActive)
            if (result.error) setMessage(result.error)
            else setMessage(result.success ?? '')
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
          if (!window.confirm('Hapus flash sale ini?')) return
          startTransition(async () => {
            setMessage(null)
            const result = await deleteFlashSaleAction(saleId)
            if (result.error) setMessage(result.error)
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
