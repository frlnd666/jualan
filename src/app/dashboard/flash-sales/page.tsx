// Halaman kelola flash sale (Fase 4) — owner-only.
// Staff ditolak (flash sale = keputusan harga pemilik) lewat
// StaffDeniedCard. Free tidak bisa membuat flash sale (tier-gated di
// server action + pemberitahuan di sini).
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOwnerStore } from '@/lib/dashboard-access'
import { getStoreSubscription, limitsFor, TIER_LABELS } from '@/lib/subscriptions'
import {
  listFlashSalesAction,
  listStoreProductsForFlashSaleAction,
} from '@/lib/actions/flash-sales'
import { isFlashSaleActive } from '@/lib/flash-sales'
import StaffDeniedCard from '@/components/dashboard/StaffDeniedCard'
import FlashSaleForm from '@/components/dashboard/FlashSaleForm'
import FlashSaleActions from '@/components/dashboard/FlashSaleActions'

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(date)
}

export default async function FlashSalesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const store = await getOwnerStore(supabase, user.id)
  if (!store) {
    return <StaffDeniedCard title="Flash Sale" />
  }

  const subscription = await getStoreSubscription(supabase, store.id)
  const limits = limitsFor(subscription)
  const flashAllowed =
    limits.flashSales && subscription.status !== 'PAST_DUE'

  const salesResult = await listFlashSalesAction()
  const sales = Array.isArray(salesResult) ? salesResult : []
  const loadError = 'error' in salesResult ? salesResult.error : null
  const productsResult = await listStoreProductsForFlashSaleAction()
  const products = Array.isArray(productsResult) ? productsResult : []

  const now = new Date()

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-4">
      <div>
        <p className="text-sm font-medium text-[var(--text-muted)]">Promosi toko</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">
          Flash Sale
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Harga promo terjadwal untuk satu produk. Paketmu saat ini:{' '}
          <strong>{TIER_LABELS[subscription.tier]}</strong> — flash sale{' '}
          {flashAllowed ? 'aktif' : 'hanya untuk Silver/Gold'}.
        </p>
      </div>

      {!flashAllowed ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Flash sale hanya tersedia untuk paket Silver dan Gold. Upgrade
          paketmu di{' '}
          <Link href="/dashboard/subscription" className="font-semibold underline">
            halaman Langganan
          </Link>{' '}
          untuk memakai fitur ini.
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      <FlashSaleForm products={products} disabled={!flashAllowed} />

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
        <h2 className="text-base font-bold text-[var(--text)]">Daftar flash sale</h2>
        {sales.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-soft)] px-4 py-5 text-sm text-[var(--text-muted)]">
            Belum ada flash sale. Buat yang pertama di atas.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {sales.map((sale) => {
              const active = isFlashSaleActive(sale, now)
              return (
                <div
                  key={sale.id}
                  className="rounded-[28px] border border-[var(--line)] bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-bold text-[var(--text)]">
                        {sale.product_name ?? 'Produk'}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                        Rp {Number(sale.promo_price).toLocaleString('id-ID')}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {formatDateTime(sale.starts_at)} –{' '}
                        {formatDateTime(sale.ends_at)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
                        active
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-gray-100 text-gray-600'
                      }`}
                    >
                      {active
                        ? 'Berjalan'
                        : sale.is_active
                          ? 'Terjadwal'
                          : 'Nonaktif'}
                    </span>
                  </div>
                  <div className="mt-4">
                    <FlashSaleActions saleId={sale.id} isActive={sale.is_active} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
