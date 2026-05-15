import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

function getOrderStatusLabel(status: string) {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'Menunggu pembayaran'
    case 'PAID':
      return 'Sudah dibayar'
    case 'PROCESSING':
      return 'Sedang diproses'
    case 'SHIPPED':
      return 'Sedang dikirim'
    case 'COMPLETED':
      return 'Selesai'
    case 'CANCELLED':
      return 'Dibatalkan'
    default:
      return status || '-'
  }
}

function getOrderStatusStyle(status: string) {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'PAID':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'PROCESSING':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    case 'SHIPPED':
      return 'bg-sky-50 text-sky-700 border-sky-200'
    case 'COMPLETED':
      return 'bg-neutral-100 text-neutral-700 border-neutral-200'
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700 border-rose-200'
    default:
      return 'bg-neutral-100 text-neutral-700 border-neutral-200'
  }
}

export default async function OrdersPage() {
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

  const { data: orders } = await supabase
    .from('orders')
    .select('id, customer_name, total, status, created_at')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })

  const totalOrders = orders?.length ?? 0
  const pendingOrders =
    orders?.filter((order) => order.status === 'PENDING_PAYMENT').length ?? 0
  const paidOrders =
    orders?.filter((order) => order.status === 'PAID').length ?? 0

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Pesanan</h1>
        <p className="mt-2 text-sm text-gray-600">
          Kelola order yang masuk dan langsung buka halaman pembayaran dari tiap pesanan.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Total order
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{totalOrders}</p>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Menunggu bayar
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-600">{pendingOrders}</p>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Sudah dibayar
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{paidOrders}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-bold text-amber-900 md:text-base">
              Verifikasi pembayaran
            </h2>
            <p className="mt-1 text-sm text-amber-800">
              Klik tombol di tiap order untuk melihat pembayaran yang paling relevan.
            </p>
          </div>
        </div>
      </section>

      <div className="space-y-3">
        {(orders ?? []).length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500">
            Belum ada pesanan masuk.
          </div>
        ) : (
          (orders ?? []).map((order) => {
            const statusStyle = getOrderStatusStyle(order.status)

            return (
              <div
                key={order.id}
                className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-gray-900">
                      {order.customer_name}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Rp {Number(order.total).toLocaleString('id-ID')}
                    </p>
                    <div className="mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold">
                      <span className={statusStyle}>
                        {getOrderStatusLabel(order.status)}
                      </span>
                    </div>
                  </div>

                  <span className="shrink-0 text-xs text-gray-400">
                    {new Date(order.created_at).toLocaleDateString('id-ID')}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
  <Link
    href={`/dashboard/orders/${order.id}`}
    className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
  >
    Detail pesanan
  </Link>

  <Link
    href={{
      pathname: '/dashboard/payments',
      query: { orderId: order.id },
    }}
    className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
  >
    Buka pembayaran
  </Link>
</div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}