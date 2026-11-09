'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  saveShipmentAction,
  updateOrderStatusAction,
} from '@/lib/actions/order-fulfillment'

interface OrderFulfillmentProps {
  orderId: string
  currentStatus: string
  initialCourier?: string | null
  initialTrackingNumber?: string | null
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  // P2-23: 'PAID' tidak pernah bisa dicapai (confirmPayment dan
  // applyQrisPaid lompat langsung ke PROCESSING) — jangan tawarkan
  // sebagai tujuan; memilihnya hanya akan ditolak action.
  { value: 'PROCESSING', label: 'Sedang diproses' },
  { value: 'SHIPPED', label: 'Sedang dikirim' },
  { value: 'COMPLETED', label: 'Selesai' },
  { value: 'CANCELLED', label: 'Dibatalkan' },
]

export default function OrderFulfillment({
  orderId,
  currentStatus,
  initialCourier,
  initialTrackingNumber,
}: OrderFulfillmentProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState(currentStatus)
  const [courier, setCourier] = useState(initialCourier ?? '')
  const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber ?? '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const isTerminal = currentStatus === 'COMPLETED' || currentStatus === 'CANCELLED'

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setMessage('')
    setError('')
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.success) {
          setError(result.error || 'Terjadi kesalahan.')
          return
        }
        setMessage('Tersimpan.')
        router.refresh()
      } catch {
        // P2-13: action melempar (mis. jaringan putus) — tampilkan pesan
        // inline, jangan biarkan error boundary menelan seluruh halaman
        // dan penjual mengira resi/status tidak tersimpan tanpa kabar.
        setError('Gagal menyimpan. Periksa koneksi lalu coba lagi.')
      }
    })
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const formData = new FormData()
          formData.set('orderId', orderId)
          formData.set('status', status)
          run(() => updateOrderStatusAction(formData))
        }}
        className="space-y-2"
      >
        <label
          htmlFor="order-status"
          className="text-xs font-semibold uppercase tracking-wide text-gray-500"
        >
          Ubah status order
        </label>
        <div className="flex gap-2">
          <select
            id="order-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={isPending || isTerminal}
            className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-900 disabled:opacity-50"
          >
            <option value={currentStatus}>{`Saat ini: ${currentStatus}`}</option>
            {STATUS_OPTIONS.filter((o) => o.value !== currentStatus).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isPending || isTerminal || status === currentStatus}
            className="shrink-0 rounded-2xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Simpan
          </button>
        </div>
        {status === 'CANCELLED' && currentStatus !== 'CANCELLED' ? (
          <p className="text-xs text-rose-600">
            Membatalkan order akan mengembalikan stok produk secara otomatis.
          </p>
        ) : null}
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          const formData = new FormData()
          formData.set('orderId', orderId)
          formData.set('courier', courier)
          formData.set('trackingNumber', trackingNumber)
          run(() => saveShipmentAction(formData))
        }}
        className="space-y-2"
      >
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Pengiriman / nomor resi
        </label>
        <input
          type="text"
          value={courier}
          onChange={(e) => setCourier(e.target.value)}
          placeholder="Kurir (cth: JNE, J&T, SiCepat)"
          disabled={isPending || isTerminal}
          className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-900 disabled:opacity-50"
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Nomor resi"
            disabled={isPending || isTerminal}
            className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-900 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isPending || isTerminal || !courier.trim() || !trackingNumber.trim()}
            className="shrink-0 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Simpan resi
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Menyimpan resi otomatis mengubah status menjadi Sedang dikirim (dari
          Sudah dibayar / Sedang diproses).
        </p>
      </form>

      {message ? <p className="text-sm font-medium text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
    </div>
  )
}
