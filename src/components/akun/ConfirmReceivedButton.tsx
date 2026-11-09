'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PackageCheck } from 'lucide-react'

import { confirmOrderReceivedAction } from '@/lib/actions/buyer-orders'

/**
 * Tombol "Pesanan diterima" untuk pembeli (status SHIPPED) —
 * menyelesaikan order tanpa menunggu seller menandainya manual.
 */
export function ConfirmReceivedButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  function handleConfirm() {
    setError('')
    startTransition(async () => {
      const result = await confirmOrderReceivedAction(orderId)
      if (!result.success) {
        setError(result.error ?? 'Gagal menyelesaikan pesanan.')
        setConfirming(false)
        return
      }
      router.refresh()
    })
  }

  return (
    <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
          <PackageCheck className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-bold text-[var(--text)]">
            Pesanan sudah sampai?
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
            Bila paket sudah kamu terima dan isinya sesuai, tandai pesanan
            ini selesai supaya penjual tahu transaksinya beres.
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3 text-sm font-medium text-[var(--error)]">
          {error}
        </p>
      ) : null}

      {confirming ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="flex-1 rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--primary-hover)] disabled:opacity-60"
          >
            {isPending ? 'Memproses…' : 'Ya, sudah diterima'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={isPending}
            className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-soft)] disabled:opacity-60"
          >
            Belum
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 w-full rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--primary-hover)]"
        >
          Pesanan diterima
        </button>
      )}
    </section>
  )
}
