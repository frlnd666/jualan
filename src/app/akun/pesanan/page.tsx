// Riwayat pesanan pembeli (Fase 2): order yang dibuat saat login
// terikat ke akun lewat orders.buyer_id (RLS: pembeli hanya melihat
// ordernya sendiri). Pesanan tamu tidak muncul di sini.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getOrderStatusLabel,
  getPaymentMethodLabel,
} from '@/lib/order-status'

type OrderRow = {
  id: string
  store_id: string
  total: number | string
  status: string
  payment_method: string | null
  created_at: string
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}

export default async function BuyerOrdersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/akun/pesanan')

  const { data: ordersData } = await supabase
    .from('orders')
    .select('id, store_id, total, status, payment_method, created_at')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)
  const orders = (ordersData ?? []) as OrderRow[]

  const storeIds = Array.from(new Set(orders.map((o) => o.store_id)))
  const storeNames = new Map<string, string>()
  if (storeIds.length > 0) {
    const { data: stores } = await supabase
      .from('stores')
      .select('id, name')
      .in('id', storeIds)
    for (const s of (stores ?? []) as Array<{ id: string; name: string }>) {
      storeNames.set(s.id, s.name)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <p className="text-sm font-medium text-[var(--text-muted)]">Akun Saya</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">
          Pesanan Saya
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          Pesanan yang kamu buat saat login. Pesanan tamu (tanpa login)
          tidak muncul di sini — lacak lewat halaman invoice yang kamu
          terima saat checkout.
        </p>
      </div>

      {orders.length === 0 ? (
        <section className="rounded-[32px] border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-sm)]">
          <p className="text-base font-bold text-[var(--text)]">
            Belum ada pesanan
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Pesananmu akan muncul di sini setelah checkout dengan akun ini.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex items-center justify-center rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-sm)]"
          >
            Mulai belanja
          </Link>
        </section>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/akun/pesanan/${order.id}`}
              className="block rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] transition active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[var(--text)]">
                    {storeNames.get(order.store_id) ?? 'Toko'}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {formatDate(order.created_at)} •{' '}
                    {getPaymentMethodLabel(order.payment_method)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-[var(--text)]">
                  Rp {Number(order.total).toLocaleString('id-ID')}
                </p>
              </div>
              <p className="mt-3">
                <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--text)]">
                  {getOrderStatusLabel(order.status)}
                </span>
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
