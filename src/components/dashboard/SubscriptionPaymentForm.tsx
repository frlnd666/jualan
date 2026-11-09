// Form pengajuan perpanjangan/upgrade langganan manual (Fase 1, Bab 6).
// Alur: pilih paket + metode → bayar ke rekening/QRIS platform → upload
// bukti → server action menyimpan subscription_payments PENDING_VERIFICATION.
// Admin memverifikasi di /dashboard/admin/subscriptions.
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  submitSubscriptionPayment,
  uploadSubscriptionProof,
} from '@/lib/actions/subscriptions'
import { TIER_PRICES } from '@/lib/subscriptions'
import {
  PLATFORM_PAYMENT_DETAILS,
  hasPlatformPaymentDetails,
} from '@/lib/subscription-payment-config'

export default function SubscriptionPaymentForm({
  currentTier,
  hasPending,
}: {
  currentTier: 'free' | 'silver' | 'gold'
  hasPending: boolean
}) {
  const router = useRouter()
  const [tier, setTier] = useState<'silver' | 'gold'>(
    currentTier === 'gold' ? 'silver' : 'silver'
  )
  const [method, setMethod] = useState<'QRIS' | 'TRANSFER'>('QRIS')
  const [file, setFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  const amount = TIER_PRICES[tier]

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    if (!file) {
      setMessage('Upload bukti pembayaran dulu (JPG/PNG/WEBP, maks 3MB).')
      return
    }
    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.set('file', file)
        const upload = await uploadSubscriptionProof(formData)
        if (upload.error || !upload.proofUrl) {
          setMessage(upload.error || 'Gagal upload bukti.')
          return
        }
        const result = await submitSubscriptionPayment({
          tier,
          method,
          proofUrl: upload.proofUrl,
        })
        if (result.error) {
          setMessage(result.error)
          return
        }
        setMessage('Pengajuan terkirim. Admin akan memverifikasi pembayaranmu.')
        setFile(null)
        router.refresh()
      } catch {
        // P2-13: action melempar (mis. jaringan putus) — jangan biarkan
        // error naik ke error boundary; tampilkan inline.
        setMessage('Gagal mengirim pengajuan. Periksa koneksi lalu coba lagi.')
      }
    })
  }

  if (hasPending) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Ada pembayaran langganan yang masih menunggu verifikasi admin. Kamu
        bisa mengajukan lagi setelah yang ini diproses.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-semibold text-[var(--text)]">
          Paket yang dibeli
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setTier('silver')}
            className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
              tier === 'silver'
                ? 'border-[var(--primary)] bg-emerald-50 text-emerald-900'
                : 'border-[var(--line)] bg-white text-[var(--text)]'
            }`}
          >
            Silver — Rp19.900 / bulan
            <span className="mt-1 block text-xs font-normal text-[var(--text-muted)]">
              30 produk, 5 foto per produk, 1 staff
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTier('gold')}
            className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
              tier === 'gold'
                ? 'border-[var(--primary)] bg-emerald-50 text-emerald-900'
                : 'border-[var(--line)] bg-white text-[var(--text)]'
            }`}
          >
            Gold — Rp50.000 / 3 bulan
            <span className="mt-1 block text-xs font-normal text-[var(--text-muted)]">
              175 produk, 10 foto per produk, 3 staff, custom domain
            </span>
          </button>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-[var(--text)]">
          Metode pembayaran
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMethod('QRIS')}
            className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
              method === 'QRIS'
                ? 'border-[var(--primary)] bg-emerald-50 text-emerald-900'
                : 'border-[var(--line)] bg-white text-[var(--text)]'
            }`}
          >
            QRIS
          </button>
          <button
            type="button"
            onClick={() => setMethod('TRANSFER')}
            className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
              method === 'TRANSFER'
                ? 'border-[var(--primary)] bg-emerald-50 text-emerald-900'
                : 'border-[var(--line)] bg-white text-[var(--text)]'
            }`}
          >
            Transfer bank
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text)]">
        <p>
          Total dibayar: <strong>Rp{amount.toLocaleString('id-ID')}</strong>
        </p>
        {hasPlatformPaymentDetails() ? (
          <div className="mt-2 space-y-1 text-xs leading-5 text-[var(--text-muted)]">
            <p className="font-semibold text-[var(--text)]">
              Bayar ke rekening/QRIS platform:
            </p>
            {PLATFORM_PAYMENT_DETAILS.bankName ? (
              <p>
                Bank: {PLATFORM_PAYMENT_DETAILS.bankName} —{' '}
                {PLATFORM_PAYMENT_DETAILS.accountNumber} a.n.{' '}
                {PLATFORM_PAYMENT_DETAILS.accountHolder}
              </p>
            ) : null}
            {PLATFORM_PAYMENT_DETAILS.qrisImageUrl ? (
              <img
                src={PLATFORM_PAYMENT_DETAILS.qrisImageUrl}
                alt="QRIS platform"
                className="mt-2 h-40 w-40 rounded-xl border border-[var(--line)] bg-white object-contain"
              />
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
            Detail rekening/QRIS platform belum diisi admin — hubungi admin
            untuk nomor pembayaran sebelum mengirim bukti.
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-[var(--text)]">
          Bukti pembayaran
        </label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-sm text-[var(--text-muted)]"
        />
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Screenshot/struk pembayaran. Format JPG, PNG, WEBP. Maksimal 3MB.
        </p>
      </div>

      {message ? (
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text)]">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {isPending ? 'Mengirim...' : 'Kirim bukti & ajukan pembayaran'}
      </button>
    </form>
  )
}
