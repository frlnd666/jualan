import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  getOrderStatusLabel,
  getOrderStatusStyle,
  getPaymentStatusLabel,
  getPaymentStatusStyle,
} from '@/lib/order-status'

type OrdersPageProps = {
  searchParams: Promise<{
    tab?: string
  }>
}

type OrderRow = {
  id: string
  customer_name: string
  customer_phone: string | null
  total: number | string
  status: string
  created_at: string
}

type InvoiceLite = {
  order_id: string
  invoice_number: string
  payment_status: string
  payment_proof_url: string | null
}

/**
 * Tab antrean kerja penjual. Satu pesanan masuk tepat satu tab utama
 * berdasarkan gabungan status order + status pembayaran invoice-nya —
 * menggantikan pemisahan lama Pesanan vs Pembayaran.
 */
const TABS = [
  { key: 'semua', label: 'Semua' },
  { key: 'perlu-verifikasi', label: 'Perlu verifikasi' },
  { key: 'belum-bayar', label: 'Belum bayar' },
  { key: 'perlu-dikirim', label: 'Perlu dikirim' },
  { key: 'dikirim', label: 'Dikirim' },
  { key: 'selesai', label: 'Selesai' },
  { key: 'batal', label: 'Batal' },
] as const

type TabKey = (typeof TABS)[number]['key']

function tabOf(order: OrderRow, invoice?: InvoiceLite): TabKey {
  if (order.status === 'CANCELLED') return 'batal'
  if (order.status === 'COMPLETED') return 'selesai'
  if (order.status === 'SHIPPED') return 'dikirim'
  if (invoice?.payment_status === 'WAITING_VERIFICATION') {
    return 'perlu-verifikasi'
  }
  if (order.status === 'PAID' || order.status === 'PROCESSING') {
    return 'perlu-dikirim'
  }
  return 'belum-bayar'
}

function actionHint(order: OrderRow, invoice?: InvoiceLite): string | null {
  const tab = tabOf(order, invoice)
  switch (tab) {
    case 'perlu-verifikasi':
      return invoice?.payment_proof_url
        ? 'Bukti transfer masuk — periksa & konfirmasi'
        : 'Pembayaran menunggu verifikasimu'
    case 'perlu-dikirim':
      return order.status === 'PROCESSING'
        ? 'Sedang disiapkan — input resi setelah dikirim'
        : 'Sudah lunas — siapkan & kirim pesanan ini'
    case 'belum-bayar':
      return 'Menunggu pembayaran customer'
    default:
      return null
  }
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const { tab: rawTab } = await searchParams
  const activeTab: TabKey =
    TABS.find((t) => t.key === rawTab)?.key ?? 'semua'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) redirect('/dashboard/settings')

  const { data: ordersData } = await supabase
    .from('orders')
    .select('id, customer_name, customer_phone, total, status, created_at')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })

  const orders = (ordersData ?? []) as OrderRow[]

  const { data: invoicesData } = orders.length
    ? await supabase
        .from('invoices')
        .select('order_id, invoice_number, payment_status, payment_proof_url')
        .in(
          'order_id',
          orders.map((o) => o.id)
        )
    : { data: [] }

  const invoiceByOrder = new Map<string, InvoiceLite>()
  for (const inv of (invoicesData ?? []) as InvoiceLite[]) {
    invoiceByOrder.set(inv.order_id, inv)
  }

  const counts = new Map<TabKey, number>()
  for (const t of TABS) counts.set(t.key, 0)
  for (const order of orders) {
    const tab = tabOf(order, invoiceByOrder.get(order.id))
    counts.set(tab, (counts.get(tab) ?? 0) + 1)
    counts.set('semua', (counts.get('semua') ?? 0) + 1)
  }

  const visibleOrders =
    activeTab === 'semua'
      ? orders
      : orders.filter(
          (order) => tabOf(order, invoiceByOrder.get(order.id)) === activeTab
        )

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Pesanan
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Semua pekerjaanmu ada di sini: verifikasi pembayaran dan pengiriman
          diatur dari satu halaman detail pesanan — tidak ada lagi menu
          pembayaran terpisah.
        </p>
      </div>

      {/* Tab antrean */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1">
        <div className="flex gap-2">
          {TABS.map((t) => {
            const isActive = activeTab === t.key
            const count = counts.get(t.key) ?? 0
            const needsAttention =
              (t.key === 'perlu-verifikasi' || t.key === 'perlu-dikirim') &&
              count > 0
            return (
              <Link
                key={t.key}
                href={
                  t.key === 'semua'
                    ? '/dashboard/orders'
                    : `/dashboard/orders?tab=${t.key}`
                }
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                  isActive
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive
                      ? 'bg-white text-gray-900'
                      : needsAttention
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {count}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        {visibleOrders.length === 0 ? (
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
          visibleOrders.map((order) => {
            const invoice = invoiceByOrder.get(order.id)
            const hint = actionHint(order, invoice)
            return (
              <Link
                key={order.id}
                href={`/dashboard/orders/${order.id}`}
                className="block rounded-3xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-gray-200 hover:shadow"
              >
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
            )
          })
        )}
      </div>
    </div>
  )
}
