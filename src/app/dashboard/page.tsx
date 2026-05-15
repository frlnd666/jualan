import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

function StatCard({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-[28px] border p-4 shadow-[var(--shadow-sm)] ${accent ? 'border-[color:var(--primary-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(242,227,216,0.9))]' : 'border-[var(--line)] bg-[var(--surface)]'}`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-[var(--text)]">{value}</p>
    </div>
  )
}

function QuickAction({ href, title, description, primary = false }: { href: string; title: string; description: string; primary?: boolean }) {
  return (
    <Link href={href} className={`rounded-[28px] border p-4 shadow-[var(--shadow-sm)] transition active:scale-[0.99] ${primary ? 'border-[color:var(--primary-soft)] bg-[var(--primary)] text-white' : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text)]'}`}>
      <p className="text-sm font-bold">{title}</p>
      <p className={`mt-1 text-xs leading-5 ${primary ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>{description}</p>
    </Link>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores')
    .select('id, name, slug')
    .eq('owner_id', user.id)
    .single()

  if (!store) redirect('/dashboard/settings')

  const [productCountRes, orderCountRes, pendingCountRes] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('store_id', store.id),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('store_id', store.id),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('store_id', store.id).eq('status', 'PENDING_PAYMENT'),
  ])

  const productCount = productCountRes.count ?? 0
  const orderCount = orderCountRes.count ?? 0
  const pendingCount = pendingCountRes.count ?? 0

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[32px] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,253,249,0.96),rgba(255,255,255,1))] p-5 shadow-[var(--shadow-md)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--text-muted)]">Overview</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text)]">Selamat datang kembali</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{user.email}</p>
          </div>
          <div className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-[11px] font-semibold text-[var(--text)]">Store aktif</div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatCard label="Total Produk" value={productCount} />
          <StatCard label="Total Pesanan" value={orderCount} />
          <StatCard label="Menunggu Pembayaran" value={pendingCount} accent />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <QuickAction href="/dashboard/products" title="Tambah produk" description="Buat produk baru dan atur harga, foto, serta deskripsi." primary />
        <QuickAction href="/dashboard/orders" title="Lihat pesanan" description="Cek order masuk dan buka pembayaran yang perlu diverifikasi." />
      </section>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--text-muted)]">Aksi cepat</p>
            <h2 className="mt-1 text-lg font-bold text-[var(--text)]">Kelola toko lebih cepat</h2>
          </div>
          <Link href="/dashboard/payments" className="text-sm font-semibold text-[var(--primary)]">Pembayaran</Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Link href="/dashboard/products" className="rounded-[24px] border border-[var(--line)] bg-white p-4 text-sm font-semibold shadow-[var(--shadow-sm)] transition active:scale-[0.99]">Tambah produk</Link>
          <Link href="/dashboard/orders" className="rounded-[24px] border border-[var(--line)] bg-white p-4 text-sm font-semibold shadow-[var(--shadow-sm)] transition active:scale-[0.99]">Pesanan masuk</Link>
          <Link href="/dashboard/payments" className="rounded-[24px] border border-[var(--line)] bg-white p-4 text-sm font-semibold shadow-[var(--shadow-sm)] transition active:scale-[0.99]">Verifikasi pembayaran</Link>
        </div>
      </section>
    </div>
  )
}
