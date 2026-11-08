// Tombol aksi langganan (Fase 1): verifikasi admin, batalkan langganan,
// dan perbaikan toko tanpa baris subscriptions.
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  cancelSubscription,
  ensureStoreSubscription,
  verifySubscriptionPayment,
} from '@/lib/actions/subscriptions'

export function VerifyPaymentButtons({ paymentId }: { paymentId: string }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  function decide(decision: 'verify' | 'reject') {
    setMessage('')
    startTransition(async () => {
      const result = await verifySubscriptionPayment(paymentId, decision)
      if (result.error) {
        setMessage(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => decide('verify')}
          disabled={isPending}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Verifikasi
        </button>
        <button
          type="button"
          onClick={() => decide('reject')}
          disabled={isPending}
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
        >
          Tolak
        </button>
      </div>
      {message ? <p className="text-xs text-red-700">{message}</p> : null}
    </div>
  )
}

export function CancelSubscriptionButton() {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  function cancel() {
    setMessage('')
    startTransition(async () => {
      const result = await cancelSubscription()
      if (result.error) {
        setMessage(result.error)
        return
      }
      setConfirming(false)
      router.refresh()
    })
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-semibold text-rose-700 hover:underline"
      >
        Batalkan langganan
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-[var(--text-muted)]">
        Batal saat trial langsung turun ke Free. Batal saat berbayar tetap
        aktif sampai akhir periode, lalu turun ke Free.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={cancel}
          disabled={isPending}
          className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Ya, batalkan
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text)]"
        >
          Urungkan
        </button>
      </div>
      {message ? <p className="text-xs text-red-700">{message}</p> : null}
    </div>
  )
}

export function ActivateFreeButton({ storeId }: { storeId: string }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  function activate() {
    setMessage('')
    startTransition(async () => {
      const result = await ensureStoreSubscription(storeId, 'free')
      if (result.error) {
        setMessage(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={activate}
        disabled={isPending}
        className="rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isPending ? 'Memproses...' : 'Aktifkan paket Free'}
      </button>
      {message ? <p className="text-xs text-red-700">{message}</p> : null}
    </div>
  )
}
