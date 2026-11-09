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
import { runSubscriptionTransitionsAction } from '@/lib/actions/subscription-transitions'

/**
 * Tombol admin untuk menjalankan transisi langganan secara manual —
 * logika yang sama dengan cron harian (lihat
 * src/lib/subscription-transitions.ts). Dipakai untuk testing dan
 * mengejar ketertinggalan bila cron sempat tidak jalan. Aman diulang:
 * transisi idempotent, pengingat di-dedup per hari.
 */
export function RunTransitionsButton() {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  function run() {
    setMessage('')
    startTransition(async () => {
      try {
        const result = await runSubscriptionTransitionsAction()
        if ('error' in result) {
          setMessage(result.error)
          return
        }
        const s = result.summary
        const changed =
          s.transitions['trial-ended'] +
          s.transitions['past-due'] +
          s.transitions.expired +
          s.transitions['cancelled-ended']
        const reminded = s.reminders.trial + s.reminders.period
        setMessage(
          `Selesai: ${s.processed} langganan diproses, ${changed} transisi ` +
            `(trial berakhir ${s.transitions['trial-ended']}, telat bayar ${s.transitions['past-due']}, ` +
            `berakhir ${s.transitions.expired}, batal berakhir ${s.transitions['cancelled-ended']}), ` +
            `${reminded} pengingat dikirim` +
            (s.remindersSkippedDuplicate > 0
              ? `, ${s.remindersSkippedDuplicate} pengingat dilewati (sudah dikirim hari ini)`
              : '') +
            (s.errors.length > 0 ? `. ${s.errors.length} error — cek log server.` : '.')
        )
        router.refresh()
      } catch {
        // P2-13: action melempar (mis. jaringan putus) — jangan biarkan
        // error naik ke error boundary; tampilkan inline.
        setMessage('Gagal menjalankan transisi. Periksa koneksi lalu coba lagi.')
      }
    })
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={isPending}
        className="rounded-xl bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? 'Menjalankan…' : 'Jalankan transisi sekarang'}
      </button>
      {message ? <p className="text-xs leading-5 text-[var(--text-muted)]">{message}</p> : null}
    </div>
  )
}

export function VerifyPaymentButtons({ paymentId }: { paymentId: string }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  function decide(decision: 'verify' | 'reject') {
    setMessage('')
    startTransition(async () => {
      try {
        const result = await verifySubscriptionPayment(paymentId, decision)
        if (result.error) {
          setMessage(result.error)
          return
        }
        router.refresh()
      } catch {
        // P2-13: action melempar (mis. jaringan putus) — jangan biarkan
        // error naik ke error boundary; tampilkan inline.
        setMessage('Gagal memproses pembayaran. Periksa koneksi lalu coba lagi.')
      }
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
      try {
        const result = await cancelSubscription()
        if (result.error) {
          setMessage(result.error)
          return
        }
        setConfirming(false)
        router.refresh()
      } catch {
        // P2-13: action melempar (mis. jaringan putus) — jangan biarkan
        // error naik ke error boundary; tampilkan inline.
        setMessage('Gagal membatalkan langganan. Periksa koneksi lalu coba lagi.')
      }
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
      try {
        const result = await ensureStoreSubscription(storeId, 'free')
        if (result.error) {
          setMessage(result.error)
          return
        }
        router.refresh()
      } catch {
        // P2-13: action melempar (mis. jaringan putus) — jangan biarkan
        // error naik ke error boundary; tampilkan inline.
        setMessage('Gagal mengaktifkan paket Free. Periksa koneksi lalu coba lagi.')
      }
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
