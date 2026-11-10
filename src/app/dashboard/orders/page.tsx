import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getDashboardAccessCached } from '@/lib/dashboard-access'
import { getCurrentUser } from '@/lib/auth-user'
import { redirect } from 'next/navigation'
import { getOrderTab, type OrderTabKey } from '@/lib/order-status'
import OrdersListClient, {
  type OrderListItem,
} from '@/components/dashboard/OrdersListClient'
import { paginate } from '@/lib/admin-ui'
import AdminPagination from '@/components/admin/AdminPagination'

type OrdersPageProps = {
  searchParams: Promise<{
    tab?: string
    page?: string
  }>
}

// Performa 2026-11-10: daftar dirender 50 per halaman (sebelumnya
// SEMUA pesanan toko dikirim ke klien sekaligus). Hitungan tab tetap
// dari data ringan yang sama; ekspor CSV tidak terpengaruh (action
// tersendiri per tab). Batas ambil 1.000 pesanan terbaru menjaga
// query tetap terbatas untuk toko yang sangat besar.
const ORDERS_PAGE_SIZE = 50
const ORDERS_FETCH_LIMIT = 1000

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

type TabKey = OrderTabKey

const TABS = [
  { key: 'semua', label: 'Semua' },
  { key: 'perlu-verifikasi', label: 'Perlu verifikasi' },
  { key: 'belum-bayar', label: 'Belum bayar' },
  { key: 'perlu-dikirim', label: 'Perlu dikirim' },
  { key: 'dikirim', label: 'Dikirim' },
  { key: 'selesai', label: 'Selesai' },
  { key: 'batal', label: 'Batal' },
] as const

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const { tab: rawTab, page: rawPage } = await searchParams
  const activeTab: TabKey =
    TABS.find((t) => t.key === rawTab)?.key ?? 'semua'

  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) redirect('/login')

  const access = await getDashboardAccessCached(user.id)
  if (!access) redirect('/dashboard/settings')
  const store = access.store

  const { data: ordersData } = await supabase
    .from('orders')
    .select('id, customer_name, customer_phone, total, status, created_at')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .limit(ORDERS_FETCH_LIMIT)

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
    const tab = getOrderTab(order.status, invoiceByOrder.get(order.id)?.payment_status)
    counts.set(tab, (counts.get(tab) ?? 0) + 1)
    counts.set('semua', (counts.get('semua') ?? 0) + 1)
  }

  const filteredOrders =
    activeTab === 'semua'
      ? orders
      : orders.filter(
          (order) =>
            getOrderTab(order.status, invoiceByOrder.get(order.id)?.payment_status) ===
            activeTab
        )
  const pageInfo = paginate(
    filteredOrders.length,
    rawPage,
    ORDERS_PAGE_SIZE
  )
  const visibleOrders: OrderListItem[] = filteredOrders
    .slice(pageInfo.from, pageInfo.to + 1)
    .map((order) => ({
      ...order,
      invoice: invoiceByOrder.get(order.id) ?? null,
    }))

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

      {/* Daftar + mode massal + export CSV (Fase 3, client). */}
      <OrdersListClient orders={visibleOrders} activeTab={activeTab} />
      <AdminPagination
        basePath="/dashboard/orders"
        page={pageInfo.page}
        pageCount={pageInfo.pageCount}
        total={pageInfo.total}
        params={{
          tab: activeTab === 'semua' ? undefined : activeTab,
        }}
        unitLabel="pesanan"
      />
    </div>
  )
}
