// Halaman analitik seller (Fase 4) — owner + staff toko.
// GMV, pendapatan lunas, order per status, penjualan harian, produk
// terlaris. Export CSV hanya Gold (ditegakkan server-side di action).
// Restyle 2026-11-11: layout ala dashboard kartu (sapaan toko, 4 kartu
// statistik berikon + delta periode sebelumnya, grafik batang pastel,
// donat status, produk terlaris berfoto, pesanan terbaru) — palet
// tetap emerald + ivory CUAN, bukan ungu referensi.
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Banknote,
  Crown,
  Plus,
  ReceiptText,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getDashboardAccess } from '@/lib/dashboard-access'
import { getSellerAnalyticsAction } from '@/lib/actions/analytics'
import { ANALYTICS_RANGES, type AnalyticsRange } from '@/lib/analytics'
import { getOrderStatusLabel } from '@/lib/order-status'
import AnalyticsExportClient from '@/components/dashboard/AnalyticsExportClient'

function formatRupiah(value: number) {
  return `Rp ${Number(value).toLocaleString('id-ID')}`
}

function isValidRange(value: string | undefined): value is AnalyticsRange {
  return value === '7d' || value === '30d' || value === '90d' || value === 'all'
}

/** Sapaan menurut jam WIB (server jalan UTC — hitung jam Asia/Jakarta). */
function wibGreeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(new Date())
  )
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 19) return 'Selamat sore'
  return 'Selamat malam'
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Jakarta',
  })
}

/** Warna batang grafik — pastel selang-seling seperti kartu toko. */
const PASTEL_BARS = ['#bfe9d2', '#f8c9d8', '#bcd6f7', '#fbe3b8']

/** Warna donat status — diurutkan mengikuti jumlah terbanyak. */
const DONUT_COLORS = ['#0b6b4a', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6']

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
  const { summary, canExport, deltas, recentOrders } = result
  const rangeLabel =
    ANALYTICS_RANGES.find((r) => r.key === range)?.label ?? '30 hari'

  const statusEntries = Object.entries(summary.byStatus).sort(
    (a, b) => b[1] - a[1]
  )
  const statusTotal = statusEntries.reduce((sum, [, count]) => sum + count, 0)
  const daily = summary.daily.slice(-14)
  const dailyMax = Math.max(1, ...daily.map((d) => d.gmv))

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-4">
      {/* Kartu sapaan — nama toko + jalan cepat ke Pesanan / Produk. */}
      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--primary-soft)] p-5 shadow-[var(--shadow-sm)] md:p-6">
        <p className="text-sm font-medium text-[var(--text-muted)]">
          Pertumbuhan toko • {rangeLabel} terakhir
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">
          {wibGreeting()}, {access.store.name}
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Penjualan, produk terlaris, dan status pesanan tokomu.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dashboard/orders"
            className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)]"
          >
            Lihat pesanan
          </Link>
          <Link
            href="/dashboard/products/new"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-soft)]"
          >
            <Plus className="h-4 w-4" /> Tambah produk
          </Link>
        </div>
      </section>

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
        <section className="flex flex-wrap items-center gap-4 rounded-[32px] border border-amber-200 bg-amber-50 p-5 shadow-[var(--shadow-sm)]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Crown className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-[var(--text)]">
              Naik ke Gold untuk export analitik
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Unduh ringkasan ini sebagai CSV untuk laporan dan pembukuan.
              Ringkasan di halaman ini tetap bisa dilihat semua paket.
            </p>
          </div>
          <Link
            href="/dashboard/subscription"
            className="shrink-0 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)]"
          >
            Lihat paket Gold
          </Link>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Banknote}
          iconBg="#e9f7ef"
          iconColor="#0b6b4a"
          label="GMV"
          value={formatRupiah(summary.gmv)}
          delta={deltas.gmv}
          current={summary.gmv}
        />
        <StatCard
          icon={Wallet}
          iconBg="#fdeef3"
          iconColor="#be185d"
          label="Lunas"
          value={formatRupiah(summary.paidRevenue)}
          delta={deltas.paidRevenue}
          current={summary.paidRevenue}
        />
        <StatCard
          icon={ShoppingBag}
          iconBg="#e8f3fd"
          iconColor="#1d4ed8"
          label="Pesanan"
          value={String(summary.orderCount)}
          delta={deltas.orderCount}
          current={summary.orderCount}
        />
        <StatCard
          icon={ReceiptText}
          iconBg="#fdf3e3"
          iconColor="#92400e"
          label="Rata-rata order"
          value={formatRupiah(summary.avgOrderValue)}
          delta={deltas.avgOrderValue}
          current={summary.avgOrderValue}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] lg:col-span-3">
          <h2 className="text-base font-bold text-[var(--text)]">
            Penjualan harian
          </h2>
          {daily.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Belum ada data harian.
            </p>
          ) : (
            <div
              className="mt-4 flex h-36 items-end gap-1.5"
              role="img"
              aria-label="Grafik penjualan harian"
            >
              {daily.map((d, i) => {
                const heightPct = Math.max(3, Math.round((d.gmv / dailyMax) * 100))
                const label = formatShortDate(`${d.date}T00:00:00`)
                return (
                  <div
                    key={d.date}
                    className="group flex min-w-0 flex-1 flex-col items-center gap-1.5"
                    title={`${label}: ${d.orders} order • ${formatRupiah(d.gmv)}`}
                  >
                    <span className="text-[11px] font-semibold whitespace-nowrap text-[var(--text-muted)] opacity-0 transition group-hover:opacity-100">
                      {formatRupiah(d.gmv)}
                    </span>
                    <div className="flex h-24 w-full items-end">
                      <div
                        className="w-full rounded-t-md transition group-hover:opacity-80"
                        style={{
                          height: `${heightPct}%`,
                          backgroundColor: PASTEL_BARS[i % PASTEL_BARS.length],
                        }}
                      />
                    </div>
                    <span className="w-full truncate text-center text-[11px] text-[var(--text-muted)]">
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] lg:col-span-2">
          <h2 className="text-base font-bold text-[var(--text)]">
            Pesanan per status
          </h2>
          {statusEntries.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Belum ada pesanan pada rentang ini.
            </p>
          ) : (
            <div className="mt-4">
              <StatusDonut entries={statusEntries} total={statusTotal} />
              <ul className="mt-4 space-y-2">
                {statusEntries.map(([status, count], i) => (
                  <li
                    key={status}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          DONUT_COLORS[i % DONUT_COLORS.length],
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium text-[var(--text)]">
                      {getOrderStatusLabel(status)}
                    </span>
                    <span className="font-bold text-[var(--text)]">
                      {count}
                    </span>
                    <span className="w-10 text-right text-[var(--text-muted)]">
                      {Math.round((count / Math.max(1, statusTotal)) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
              <p className="pt-3 text-xs text-[var(--text-muted)]">
                Dibatalkan: {summary.cancelledCount} • Lunas:{' '}
                {summary.paidOrderCount}
              </p>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-bold text-[var(--text)]">
              Produk terlaris
            </h2>
            <Link
              href="/dashboard/products"
              className="text-sm font-semibold text-[var(--primary)]"
            >
              Lihat semua
            </Link>
          </div>
          {summary.topProducts.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Belum ada produk terjual pada rentang ini.
            </p>
          ) : (
            <ol className="mt-4 space-y-3">
              {summary.topProducts.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3">
                  {p.image ? (
                    <Image
                      src={p.image}
                      alt=""
                      width={44}
                      height={44}
                      className="h-11 w-11 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold"
                      style={{
                        backgroundColor:
                          PASTEL_BARS[i % PASTEL_BARS.length],
                        color: 'var(--text)',
                      }}
                    >
                      {p.name.trim().charAt(0).toUpperCase() || '?'}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
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
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-bold text-[var(--text)]">
              Pesanan terbaru
            </h2>
            <Link
              href="/dashboard/orders"
              className="text-sm font-semibold text-[var(--primary)]"
            >
              Lihat semua
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Belum ada pesanan pada rentang ini.
            </p>
          ) : (
            <ol className="mt-4 space-y-3">
              {recentOrders.map((order) => (
                <li key={order.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[var(--text)]">
                      {order.invoiceNumber || 'Pesanan'}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {formatShortDate(order.createdAt)} •{' '}
                      {getOrderStatusLabel(order.status)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-[var(--text)]">
                    {formatRupiah(order.total)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  delta,
  current,
}: {
  icon: LucideIcon
  iconBg: string
  iconColor: string
  label: string
  value: string
  /** Perubahan persen vs periode sebelumnya (null = tak terhitung). */
  delta: number | null
  /** Nilai periode sekarang — menentukan label "Baru" bila delta null. */
  current: number
}) {
  return (
    <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-2xl"
        style={{ backgroundColor: iconBg, color: iconColor }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-[11px] font-medium tracking-[0.18em] text-[var(--text-muted)] uppercase">
        {label}
      </p>
      <p className="mt-1 text-base leading-6 font-bold text-[var(--text)]">
        {value}
      </p>
      <DeltaBadge delta={delta} current={current} />
    </div>
  )
}

/**
 * Badge perubahan vs periode sebelumnya. delta null + nilai sekarang
 * > 0 = periode pertama ada penjualan ("Baru"); delta null + nilai 0
 * = tidak ada data pembanding (tidak tampil).
 */
function DeltaBadge({
  delta,
  current,
}: {
  delta: number | null
  current: number
}) {
  if (delta === null) {
    if (current <= 0) return null
    return (
      <p className="mt-2 text-xs font-semibold text-[var(--text-muted)]">
        Baru di periode ini
      </p>
    )
  }
  const rounded = Math.round(delta)
  if (rounded === 0) {
    return (
      <p className="mt-2 text-xs font-semibold text-[var(--text-muted)]">
        Sama seperti periode lalu
      </p>
    )
  }
  const up = rounded > 0
  return (
    <p
      className={`mt-2 flex items-center gap-1 text-xs font-semibold ${
        up ? 'text-emerald-700' : 'text-red-600'
      }`}
      title="Dibandingkan periode sebelumnya dengan panjang yang sama"
    >
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {up ? '+' : ''}
      {rounded}% vs periode lalu
    </p>
  )
}

/** Donat SVG murni (tanpa library chart) untuk pesanan per status. */
function StatusDonut({
  entries,
  total,
}: {
  entries: Array<[string, number]>
  total: number
}) {
  const R = 64
  const C = 2 * Math.PI * R
  // Segmen dihitung dulu (tanpa mutasi saat render): tiap segmen tahu
  // panjang busur dan offset awalnya.
  const segments = entries.reduce<
    Array<{ status: string; len: number; dashOffset: number }>
  >((acc, [status, count]) => {
    const prev = acc[acc.length - 1]
    const start = prev ? prev.dashOffset - prev.len : 0
    return [
      ...acc,
      {
        status,
        len: (count / Math.max(1, total)) * C,
        dashOffset: start,
      },
    ]
  }, [])
  return (
    <div className="flex justify-center">
      <svg
        width={160}
        height={160}
        viewBox="0 0 160 160"
        role="img"
        aria-label={`${total} pesanan dalam rentang ini`}
      >
        <circle
          cx={80}
          cy={80}
          r={R}
          fill="none"
          stroke="var(--surface-soft)"
          strokeWidth={22}
        />
        {segments.map(({ status, len, dashOffset }, i) => (
          <circle
            key={status}
            cx={80}
            cy={80}
            r={R}
            fill="none"
            stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
            strokeWidth={22}
            strokeDasharray={`${Math.max(0, len - 1.5)} ${C - Math.max(0, len - 1.5)}`}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 80 80)"
          />
        ))}
        <text
          x={80}
          y={76}
          textAnchor="middle"
          className="fill-[var(--text)] text-2xl font-bold"
        >
          {total}
        </text>
        <text
          x={80}
          y={98}
          textAnchor="middle"
          className="fill-[var(--text-muted)] text-xs"
        >
          pesanan
        </text>
      </svg>
    </div>
  )
}
