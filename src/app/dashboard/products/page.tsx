import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

function formatRupiah(value: number | string | null) {
  const numeric = Number(value ?? 0)
  if (Number.isNaN(numeric)) return '0'
  return numeric.toLocaleString('id-ID')
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(date)
}

function getAvailabilityLabel(available: boolean) {
  return available ? 'Aktif' : 'Nonaktif'
}

function getAvailabilityStyle(available: boolean) {
  return available
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-gray-200 bg-gray-100 text-gray-600'
}

function getStockLabel(stock: number | null) {
  const value = stock ?? 0

  if (value <= 0) return 'Stok habis'
  if (value <= 5) return 'Stok menipis'
  return 'Stok aman'
}

function getStockStyle(stock: number | null) {
  const value = stock ?? 0

  if (value <= 0) return 'text-rose-600'
  if (value <= 5) return 'text-amber-600'
  return 'text-emerald-600'
}

export default async function ProductsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores')
    .select('id, slug')
    .eq('owner_id', user.id)
    .single()

  if (!store) redirect('/dashboard/settings')

  const { data: products } = await supabase
    .from('products')
    .select('id, name, slug, price, stock, available, created_at')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })

  const productList = products ?? []
  const totalProducts = productList.length
  const activeProducts = productList.filter((product) => product.available).length
  const lowStockProducts = productList.filter(
    (product) => (product.stock ?? 0) > 0 && (product.stock ?? 0) <= 5,
  ).length

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
            Produk
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Kelola katalog toko, cek stok, dan atur produk yang tampil di toko.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/shipping"
            className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] transition hover:bg-[var(--surface-soft)]"
          >
            Ekspedisi
          </Link>

          <Link
            href="/dashboard/products/new"
            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:opacity-95 active:scale-[0.98]"
          >
            + Tambah
          </Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Total produk
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--text)]">
            {totalProducts}
          </p>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Produk aktif
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {activeProducts}
          </p>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Stok menipis
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {lowStockProducts}
          </p>
        </div>
      </section>

      {productList.length === 0 ? (
        <section className="rounded-[32px] border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-sm)]">
          <p className="text-base font-bold text-[var(--text)]">
            Belum ada produk
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Tambahkan produk pertama agar toko kamu mulai terlihat aktif dan siap menerima pesanan.
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link
              href="/dashboard/products/new"
              className="inline-flex items-center justify-center rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-sm)]"
            >
              Tambah produk pertama
            </Link>

            <Link
              href="/dashboard/shipping"
              className="inline-flex items-center justify-center rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text)]"
            >
              Atur ekspedisi
            </Link>
          </div>
        </section>
      ) : (
        <div className="space-y-3">
          {productList.map((product) => (
            <section
              key={product.id}
              className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-[var(--text)]">
                    {product.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                    /{product.slug}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-[var(--text)]">
                    Rp {formatRupiah(product.price)}
                  </p>
                </div>

                <span
                  className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${getAvailabilityStyle(product.available)}`}
                >
                  {getAvailabilityLabel(product.available)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    Stok
                  </p>
                  <p className="mt-1 text-sm font-bold text-[var(--text)]">
                    {product.stock ?? 0}
                  </p>
                  <p className={`mt-1 text-xs font-medium ${getStockStyle(product.stock)}`}>
                    {getStockLabel(product.stock)}
                  </p>
                </div>

                <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    Dibuat
                  </p>
                  <p className="mt-1 text-sm font-bold text-[var(--text)]">
                    {formatDate(product.created_at)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Produk terdaftar
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/${store.slug}/products/${product.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-soft)]"
                >
                  Preview produk
                </Link>

                <Link
                  href={`/dashboard/products/${product.id}`}
                  className="inline-flex items-center justify-center rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                >
                  Edit produk
                </Link>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}