// Daftar pesanan seller (Fase 3) — Client Component.
// Menambahkan di atas daftar lama (server): mode massal (pilih banyak
// order → ubah status sekaligus) + export CSV. Tampilan kartu order
// sama seperti sebelumnya supaya tidak ada perubahan visual yang
// tidak diminta.
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  getOrderStatusLabel,
  getOrderStatusStyle,
  getPaymentStatusLabel,
  getPaymentStatusStyle,
} from '@/lib/order-status'
import {
  bulkUpdateOrderStatusAction,
  exportOrdersCsvAction,
} from '@/lib/actions/order-management'
import type { OrderStatus } from '@/lib/types/order'

export interface OrderListItem {
  id: string
  customer_name: string
  customer_phone: string | null
  total: number | string
  status: string
  created_at: string
  invoice?: {
    invoice_number: string
    payment_status: string
    payment_proof_url: string | null
  } | null
}

const BULK_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'PROCESSING', label: 'Sedang diproses' },
  { value: 'SHIPPED', label: 'Dikirim' },
  { value: 'COMPLETED', label: 'Selesai' },
  { value: 'CANCELLED', label: 'Batalkan' },
]

function actionHint(order: OrderListItem): string | null {
  const invoice = order.invoice
  if (order.status === 'CANCELLED' || order.status === 'COMPLETED' || order.status === 'SHIPPED') {
    return null
  }
  if (invoice?.payment_status === 'WAITING_VERIFICATION') {
    return invoice?.payment_proof_url
      ? 'Bukti transfer masuk — periksa & konfirmasi'
      : 'Pembayaran menunggu verifikasimu'
  }
  if (order.status === 'PAID' || order.status === 'PROCESSING') {
    return order.status === 'PROCESSING'
      ? 'Sedang disiapkan — input resi setelah dikirim'
      : 'Sudah lunas — siapkan & kirim pesanan ini'
  }
  return 'Menunggu pembayaran customer'
}

export default function OrdersListClient({
  orders,
  activeTab,
}: {
  orders: OrderListItem[]
  activeTab: string
}) {
  const router = useRouter()
  const [bulkMode, setBulkMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>('PROCESSING')
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState('')

  function toggleSelect(orderId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === orders.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(orders.map((o) => o.id)))
    }
  }

  async function applyBulk() {
    if (selected.size === 0) {
      setMessage('Pilih minimal satu pesanan.')
      return
    }
    setBusy(true)
    setMessage('')
    const formData = new FormData()
    formData.set('orderIds', JSON.stringify([...selected]))
    formData.set('status', bulkStatus)
    const result = await bulkUpdateOrderStatusAction(formData)
    setBusy(false)
    if (result.updated > 0) {
      setMessage(
        `${result.updated} pesanan diubah.` +
          (result.failed.length > 0
            ? ` ${result.failed.length} gagal (${result.failed[0].error}).`
            : '')
      )
      setSelected(new Set())
      setBulkMode(false)
      router.refresh()
    } else {
      setMessage(
        result.error ?? result.failed[0]?.error ?? 'Tidak ada pesanan yang berubah.'
      )
    }
  }

  async function exportCsv() {
    setExporting(true)
    setMessage('')
    const result = await exportOrdersCsvAction({ tab: activeTab })
    setExporting(false)
    if (!result.success) {
      setMessage(result.error)
      return
    }
    const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3">
      {/* Toolbar: mode massal + export */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setBulkMode((v) => !v)
            setSelected(new Set())
            setMessage('')
          }}
          className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
            bulkMode
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          {bulkMode ? 'Batalkan mode massal' : 'Mode massal'}
        </button>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting}
          className="rounded-full border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          {exporting ? 'Menyiapkan CSV...' : 'Export CSV'}
        </button>
        {bulkMode && orders.length > 0 ? (
          <button
            type="button"
            onClick={toggleAll}
            className="rounded-full border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            {selected.size === orders.length ? 'Batalkan semua pilihan' : 'Pilih semua'}
          </button>
        ) : null}
      </div>

      {bulkMode && selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-sm font-semibold text-indigo-900">
            {selected.size} pesanan dipilih
          </p>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}
            className="rounded-2xl border border-indigo-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900"
          >
            {BULK_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                Ubah ke: {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyBulk}
            disabled={busy}
            className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Memproses...' : 'Terapkan'}
          </button>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          {message}
        </div>
      ) : null}

      {orders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-gray-900">
            {activeTab === 'semua'
              ? 'Belum ada pesanan masuk.'
              : 'Tidak ada pesanan di antrean ini.'}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {activeTab === 'perlu-verifikasi' || activeTab === 'perlu-dikirim'
              ? 'Kerja bagus — antrean tindakanmu kosong.'
              : 'Pesanan baru akan muncul di sini begitu customer checkout.'}
          </p>
        </div>
      ) : (
        orders.map((order) => {
          const invoice = order.invoice
          const hint = actionHint(order)
          const checked = selected.has(order.id)
          return (
            <div
              key={order.id}
              className="flex items-start gap-3 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-gray-200 hover:shadow"
            >
              {bulkMode ? (
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSelect(order.id)}
                  aria-label={`Pilih pesanan ${order.customer_name}`}
                  className="mt-1 h-5 w-5 shrink-0 accent-gray-900"
                />
              ) : null}
              <Link href={`/dashboard/orders/${order.id}`} className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-gray-900">
                      {order.customer_name}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {invoice?.invoice_number ?? 'Tanpa invoice'} •{' '}
                      {new Date(order.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <p className="shrink-0 text-base font-bold text-gray-900">
                    Rp {Number(order.total).toLocaleString('id-ID')}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getOrderStatusStyle(order.status)}`}
                  >
                    {getOrderStatusLabel(order.status)}
                  </span>
                  {invoice ? (
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getPaymentStatusStyle(invoice.payment_status)}`}
                    >
                      Bayar: {getPaymentStatusLabel(invoice.payment_status)}
                    </span>
                  ) : null}
                  {invoice?.payment_proof_url ? (
                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Bukti masuk ✓
                    </span>
                  ) : null}
                </div>

                {hint ? (
                  <p className="mt-3 rounded-2xl bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">
                    {hint} →
                  </p>
                ) : null}
              </Link>
            </div>
          )
        })
      )}
    </div>
  )
}
