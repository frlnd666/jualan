import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string
  value: number
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-[28px] border p-4 shadow-[var(--shadow-sm)] ${
        accent
          ? 'border-rose-200 bg-rose-50'
          : 'border-[var(--line)] bg-[var(--surface)]'
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </p>
      <p
        className={`mt-3 text-3xl font-bold tracking-tight ${
          accent ? 'text-rose-600' : 'text-[var(--text)]'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

type ActionItem = {
  orderId: string
  customerName: string
  total: number | string
  invoiceNumber: string | null
  kind: 'verifikasi' | 'kirim'
  createdAt: string
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores')
    .select('id, name, slug')
    .eq('owner_id', user.id)
    .single()

  if (!store) redirect('/dashboard/settings')

  const { count: productCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', store.id)

  const { data: ordersData } = await supabase
    .from('orders')
    .select('id, customer_name, total, status, created_at')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .limit(200)

  const orders = ordersData ?? []

  const { data: invoicesData } = orders.length
    ? await supabase
        .from('invoices')
        .select('order_id, invoice_number, payment_status, payment_proof_url')
        .in(
          'order_id',
          orders.map((o) => o.id)
        )
    : { data: [] }

  const invoiceByOrder = new Map(
    (invoicesData ?? []).map((inv) => [inv.order_id, inv])
  )

  // Antrean "Perlu tindakan": dua pekerjaan nyata penjual, dihitung dari
  // gabungan status order + invoice (sumber yang sama dengan tab Pesanan).
  const actions: ActionItem[] = []
  let belumBayarCount = 0

  for (const order of orders) {
    const invoice = invoiceByOrder.get(order.id)
    if (invoice?.payment_status === 'WAITING_VERIFICATION') {
      actions.push({
        orderId: order.id,
        customerName: order.customer_name,
        total: order.total,
        invoiceNumber: invoice.invoice_number,
        kind: 'verifikasi',
        createdAt: order.created_at,
      })
    } else if (
      (order.status === 'PAID' || order.status === 'PROCESSING') &&
      invoice?.payment_status === 'PAID'
    ) {
      actions.push({
        orderId: order.id,
        customerName: order.customer_name,
        total: order.total,
        invoiceNumber: invoice?.invoice_number ?? null,
        kind: 'kirim',
        createdAt: order.created_at,
      })
    } else if (
      order.status === 'PENDING_PAYMENT' &&
      invoice?.payment_status === 'PENDING_PAYMENT'
    ) {
      belumBayarCount += 1
    }
  }

  const verifikasiCount = actions.filter((a) => a.kind === 'verifikasi').length
  const kirimCount = actions.filter((a) => a.kind === 'kirim').length
  const visibleActions = actions.slice(0, 5)

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[32px] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,253,249,0.96),rgba(255,255,255,1))] p-5 shadow-[var(--shadow-md)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--text-muted)]">
              Overview
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text)]">
              Selamat datang kembali
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              {store.name} • {user.email}
            </p>
          </div>
          <div className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-[11px] font-semibold text-[var(--text)]">
            Store aktif
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total Produk" value={productCount ?? 0} />
          <StatCard label="Total Pesanan" value={orders.length} />
          <StatCard
            label="Perlu Verifikasi"
            value={verifikasiCount}
            accent={verifikasiCount > 0}
          />
          <StatCard
            label="Perlu Dikirim"
            value={kirimCount}
            accent={kirimCount > 0}
          />
        </div>
      </section>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--text-muted)]">
              Perlu tindakan
            </p>
            <h2 className="mt-1 text-lg font-bold text-[var(--text)]">
              {actions.length > 0
                ? `${actions.length} pesanan menunggu aksimu`
                : 'Tidak ada yang menunggu'}
            </h2>
          </div>
          <Link
            href="/dashboard/orders"
            className="shrink-0 text-sm font-semibold text-[var(--primary)]"
          >
            Semua pesanan
          </Link>
        </div>

        {visibleActions.length === 0 ? (
          <div className="mt-4 rounded-[24px] border border-dashed border-[var(--line)] bg-[var(--surface-soft)] px-4 py-6 text-center">
            <p className="text-sm font-semibold text-[var(--text)]">
              Semua beres 🎉
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Tidak ada pembayaran yang perlu diverifikasi dan tidak ada
              pesanan lunas yang menunggu dikirim.
              {belumBayarCount > 0
                ? ` Ada ${belumBayarCount} pesanan yang masih menunggu pembayaran customer.`
                : ''}
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {visibleActions.map((action) => (
              <Link
                key={action.orderId}
                href={`/dashboard/orders/${action.orderId}`}
                className="flex items-center justify-between gap-3 rounded-[24px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)] transition active:scale-[0.99]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[var(--text)]">
                    {action.customerName}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {action.invoiceNumber ?? 'Tanpa invoice'} • Rp{' '}
                    {Number(action.total).toLocaleString('id-ID')}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    action.kind === 'verifikasi'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {action.kind === 'verifikasi'
                    ? 'Verifikasi pembayaran'
                    : 'Siapkan & kirim'}
                </span>
              </Link>
            ))}
            {actions.length > visibleActions.length ? (
              <Link
                href="/dashboard/orders?tab=perlu-verifikasi"
                className="block rounded-[24px] border border-dashed border-[var(--line)] px-4 py-3 text-center text-sm font-semibold text-[var(--primary)]"
              >
                + {actions.length - visibleActions.length} pesanan lain di
                antrean Pesanan
              </Link>
            ) : null}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/dashboard/products/new"
          className="rounded-[28px] border border-[color:var(--primary-soft)] bg-[var(--primary)] p-4 text-white shadow-[var(--shadow-sm)] transition active:scale-[0.99]"
        >
          <p className="text-sm font-bold">Tambah produk</p>
          <p className="mt-1 text-xs leading-5 text-white/80">
            Buat produk baru dan atur harga, foto, serta deskripsi.
          </p>
        </Link>
        <Link
          href="/dashboard/shipping"
          className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--text)] shadow-[var(--shadow-sm)] transition active:scale-[0.99]"
        >
          <p className="text-sm font-bold">Metode pengiriman</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            Atur kurir dan ongkos kirim yang ditawarkan ke customer.
          </p>
        </Link>
        <Link
          href="/dashboard/subscription"
          className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--text)] shadow-[var(--shadow-sm)] transition active:scale-[0.99]"
        >
          <p className="text-sm font-bold">Langganan</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            Paket, batas produk, upgrade, dan perpanjangan.
          </p>
        </Link>
        <Link
          href="/dashboard/settings"
          className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--text)] shadow-[var(--shadow-sm)] transition active:scale-[0.99]"
        >
          <p className="text-sm font-bold">Pengaturan toko</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            Nama, alamat, WhatsApp, logo, dan tampilan tokomu.
          </p>
        </Link>
      </section>
    </div>
  )
}
