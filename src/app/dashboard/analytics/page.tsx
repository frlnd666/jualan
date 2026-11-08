// Halaman analitik seller (Fase 4) — owner + staff toko.
// GMV, pendapatan lunas, order per status, penjualan harian, produk
// terlaris. Export CSV hanya Gold (ditegakkan server-side di action).
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDashboardAccess } from '@/lib/dashboard-access'
import { getSellerAnalyticsAction } from '@/lib/actions/analytics'
import { ANALYTICS_RANGES, type AnalyticsRange } from '@/lib/analytics'
import AnalyticsExportClient from '@/components/dashboard/AnalyticsExportClient'

function formatRupiah(value: number) {
  return `Rp ${Number(value).toLocaleString('id-ID')}`
}

function isValidRange(value: string | undefined): value is AnalyticsRange {
  return value === '7d' || value === '30d' || value === '90d' || value === 'all'
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const { range: rawRange } = await searchParams
  const range: AnalyticsRange = isValidRange(rawRange) ? rawRange : '30d'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const access = await getDashboardAccess(supabase, user.id)
  if (!access) redirect('/dashboard/settings')

  const result = await getSellerAnalyticsAction(range)
  if ('error' in result) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-4">
        <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {result.error}
        </div>
      </div>
    )
  }
  const { summary, canExport } = result

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-4">
      <div>
        <p className="text-sm font-medium text-[var(--text-muted)]">Pertumbuhan toko</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">
          Analitik
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Penjualan, produk terlaris, dan status pesanan tokomu.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {ANALYTICS_RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/dashboard/analytics?range=${r.key}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              r.key === range
                ? 'bg-[var(--primary)] text-white'
                : 'border border-[var(--line)] bg-white text-[var(--text)]'
            }`}
          >
            {r.label}
          </Link>
        ))}
        <span className="ml-auto">
          <AnalyticsExportClient range={range} canExport={canExport} />
        </span>
      </div>

      {!canExport ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Export analitik (CSV) hanya untuk paket Gold. Ringkasan di bawah
          tetap bisa dilihat semua paket. Upgrade di{' '}
          <Link href="/dashboard/subscription" className="font-semibold underline">
            halaman Langganan
          </Link>
          .
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="GMV" value={formatRupiah(summary.gmv)} />
        <StatCard label="Lunas" value={formatRupiah(summary.paidRevenue)} />
        <StatCard label="Pesanan" value={String(summary.orderCount)} />
        <StatCard
          label="Rata-rata order"
          value={formatRupiah(summary.avgOrderValue)}
        />
      </section>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
        <h2 className="text-base font-bold text-[var(--text)]">
          Pesanan per status
        </h2>
        {Object.keys(summary.byStatus).length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Belum ada pesanan pada rentang ini.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {Object.entries(summary.byStatus)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => (
                <div key={status} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-[var(--text)]">
                    {status}
                  </span>
                  <span className="text-sm font-bold text-[var(--text)]">{count}</span>
                </div>
              ))}
            <p className="pt-2 text-xs text-[var(--text-muted)]">
              Dibatalkan: {summary.cancelledCount} • Lunas: {summary.paidOrderCount}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
        <h2 className="text-base font-bold text-[var(--text)]">Produk terlaris</h2>
        {summary.topProducts.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Belum ada produk terjual pada rentang ini.
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {summary.topProducts.map((p, i) => (
              <li key={p.name} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[var(--text)]">
                    {i + 1}. {p.name}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Terjual {p.qty}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-[var(--text)]">
                  {formatRupiah(p.revenue)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
        <h2 className="text-base font-bold text-[var(--text)]">Penjualan harian</h2>
        {summary.daily.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Belum ada data harian.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {summary.daily
              .slice(-14)
              .reverse()
              .map((d) => (
                <div key={d.date} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[var(--text-muted)]">{d.date}</span>
                  <span className="text-sm font-semibold text-[var(--text)]">
                    {d.orders} order • {formatRupiah(d.gmv)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-base font-bold leading-6 text-[var(--text)]">{value}</p>
    </div>
  )
}
