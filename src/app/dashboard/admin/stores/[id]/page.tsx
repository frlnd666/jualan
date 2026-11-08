// Detail toko untuk admin platform (Fase 2): info toko + pemilik +
// langganan + statistik + order terbaru + aksi bekukan/buka bekukan.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminUser } from '@/lib/admin-access'
import AdminStoreActions from '@/components/dashboard/AdminStoreActions'

export default async function AdminStoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const adminCheck = await requireAdminUser(supabase)
  if ('error' in adminCheck) {
  return (
    <div className="mx-auto max-w-xl space-y-4 pt-6">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
        Admin Platform
      </h1>
      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-sm)]">
        <p className="text-base font-bold text-[var(--text)]">
          Halaman ini hanya untuk admin platform
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          Akunmu tidak punya hak admin. Kembali ke dashboard tokomu.
        </p>
      </section>
    </div>
  )
  }

  const admin = createAdminClient()
  if (!admin) redirect('/dashboard/admin')

  const { data: storeData } = await admin
    .from('stores')
    .select('id, name, slug, owner_id, city, created_at')
    .eq('id', id)
    .maybeSingle()
  const store = storeData as {
    id: string
    name: string
    slug: string
    owner_id: string
    city: string | null
    created_at: string
  } | null
  if (!store) redirect('/dashboard/admin')

  let ownerEmail = store.owner_id
  try {
    const { data } = await admin.auth.admin.getUserById(store.owner_id)
    if (data.user?.email) ownerEmail = data.user.email
  } catch {}

  const [{ data: subData }, { count: productCount }, { data: ordersData }] =
    await Promise.all([
      admin
        .from('subscriptions')
        .select('tier, status, current_period_end, trial_ends_at')
        .eq('store_id', store.id)
        .maybeSingle(),
      admin
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', store.id),
      admin
        .from('orders')
        .select('id, customer_name, total, status, created_at')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

  const sub = subData as {
    tier: string
    status: string
    current_period_end: string | null
    trial_ends_at: string | null
  } | null
  const orders = (ordersData ?? []) as Array<{
    id: string
    customer_name: string
    total: number | string
    status: string
    created_at: string
  }>
  const gmv = orders.reduce(
    (sum, o) => sum + (o.status === 'CANCELLED' ? 0 : Number(o.total || 0)),
    0
  )

  return (
    <div className="mx-auto max-w-2xl space-y-5 pt-6">
      <div>
        <Link
          href="/dashboard/admin"
          className="text-sm font-semibold text-[var(--primary)]"
        >
          ← Semua toko
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text)]">
          {store.name}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          /{store.slug} • {ownerEmail} •{' '}
          {store.city ?? 'kota belum diisi'} • daftar{' '}
          {new Date(store.created_at).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'Asia/Jakarta',
          })}
        </p>
      </div>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
        <h2 className="text-base font-bold text-[var(--text)]">Langganan</h2>
        {sub ? (
          <div className="mt-3 space-y-1 text-sm">
            <p>
              Paket: <strong>{sub.tier}</strong> • Status:{' '}
              <strong>{sub.status}</strong>
            </p>
            {sub.current_period_end ? (
              <p className="text-[var(--text-muted)]">
                Periode berakhir:{' '}
                {new Date(sub.current_period_end).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            ) : null}
            {sub.trial_ends_at ? (
              <p className="text-[var(--text-muted)]">
                Trial berakhir:{' '}
                {new Date(sub.trial_ends_at).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Toko ini belum punya baris langganan.
          </p>
        )}
        <div className="mt-4">
          <AdminStoreActions
            storeId={store.id}
            storeName={store.name}
            isSuspended={sub?.status === 'SUSPENDED'}
          />
        </div>
        <Link
          href="/dashboard/admin/subscriptions"
          className="mt-4 inline-block text-sm font-semibold text-[var(--primary)]"
        >
          Lihat pembayaran langganan →
        </Link>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Produk
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--text)]">
            {productCount ?? 0}
          </p>
        </div>
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Order
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--text)]">
            {orders.length}
          </p>
        </div>
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
            GMV (10 terakhir)
          </p>
          <p className="mt-2 text-lg font-bold text-[var(--text)]">
            Rp {gmv.toLocaleString('id-ID')}
          </p>
        </div>
      </section>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
        <h2 className="text-base font-bold text-[var(--text)]">Order terbaru</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Belum ada order di toko ini.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {orders.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-soft)] px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-[var(--text)]">
                    {order.customer_name}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {order.status} •{' '}
                    {new Date(order.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <p className="font-bold text-[var(--text)]">
                  Rp {Number(order.total).toLocaleString('id-ID')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
