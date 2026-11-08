// Analitik seller (Fase 4, rencana SaaS Bab 7).
// Fungsi MURNI (tidak menyentuh database) supaya gampang dites.
// Data dibaca server action dari orders / order_items / invoices
// yang sudah ada — TIDAK ada tabel baru untuk analitik.
//
// Definisi:
// - GMV = total semua order yang TIDAK dibatalkan (termasuk yang
//   masih menunggu bayar) — ukuran volume toko.
// - Pendapatan lunas = total order yang invoice-nya PAID.
// - Rata-rata order = GMV / jumlah order tidak batal.

export type AnalyticsRange = '7d' | '30d' | '90d' | 'all'

export const ANALYTICS_RANGES: Array<{ key: AnalyticsRange; label: string }> = [
  { key: '7d', label: '7 hari' },
  { key: '30d', label: '30 hari' },
  { key: '90d', label: '90 hari' },
  { key: 'all', label: 'Semua' },
]

export function rangeStart(range: AnalyticsRange, now: Date = new Date()): Date | null {
  if (range === 'all') return null
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
}

export interface AnalyticsOrderRow {
  id: string
  total: number
  status: string
  created_at: string
}

export interface AnalyticsItemRow {
  order_id: string
  product_name: string | null
  qty: number
  price: number
  subtotal: number
}

export interface AnalyticsInvoiceRow {
  order_id: string
  payment_status: string
}

export interface DailyPoint {
  date: string // YYYY-MM-DD (WIB)
  orders: number
  gmv: number
  paid: number
}

export interface TopProduct {
  name: string
  qty: number
  revenue: number
}

export interface AnalyticsSummary {
  gmv: number
  paidRevenue: number
  orderCount: number
  paidOrderCount: number
  cancelledCount: number
  avgOrderValue: number
  byStatus: Record<string, number>
  daily: DailyPoint[]
  topProducts: TopProduct[]
}

function wibDateKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function dayKeysBetween(start: Date, end: Date): string[] {
  const keys: string[] = []
  const cursor = new Date(start)
  cursor.setUTCHours(0, 0, 0, 0)
  const last = new Date(end)
  last.setUTCHours(0, 0, 0, 0)
  while (cursor <= last) {
    keys.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return keys
}

/**
 * Hitung ringkasan analitik dari baris order/item/invoice yang sudah
 * difilter rentang oleh server action. Semua angka rupiah dibulatkan
 * ke bawah (total di database numeric).
 */
export function computeAnalytics(
  orders: AnalyticsOrderRow[],
  items: AnalyticsItemRow[],
  invoices: AnalyticsInvoiceRow[],
  range: AnalyticsRange,
  now: Date = new Date()
): AnalyticsSummary {
  const paidByOrder = new Map<string, boolean>()
  for (const inv of invoices) {
    if (inv.payment_status === 'PAID') paidByOrder.set(inv.order_id, true)
  }

  const start = rangeStart(range, now)
  const end = now
  const dayKeys =
    start !== null
      ? dayKeysBetween(start, end)
      : (() => {
          const keys = new Set<string>()
          for (const o of orders) {
            const k = wibDateKey(o.created_at)
            if (k) keys.add(k)
          }
          return [...keys].sort()
        })()

  const dailyMap = new Map<string, DailyPoint>()
  for (const key of dayKeys) {
    dailyMap.set(key, { date: key, orders: 0, gmv: 0, paid: 0 })
  }

  let gmv = 0
  let paidRevenue = 0
  let orderCount = 0
  let paidOrderCount = 0
  let cancelledCount = 0
  const byStatus: Record<string, number> = {}

  for (const order of orders) {
    const total = Math.max(0, Math.floor(Number(order.total) || 0))
    const status = String(order.status ?? '')
    byStatus[status] = (byStatus[status] ?? 0) + 1
    if (status === 'CANCELLED') {
      cancelledCount += 1
      continue
    }
    orderCount += 1
    gmv += total
    const isPaid = paidByOrder.get(order.id) === true
    if (isPaid) {
      paidRevenue += total
      paidOrderCount += 1
    }
    const key = wibDateKey(order.created_at)
    const point = key ? dailyMap.get(key) : undefined
    if (point) {
      point.orders += 1
      point.gmv += total
      if (isPaid) point.paid += total
    }
  }

  // Produk terlaris dihitung dari item order yang TIDAK dibatalkan.
  const cancelledIds = new Set(
    orders.filter((o) => String(o.status) === 'CANCELLED').map((o) => o.id)
  )
  const productMap = new Map<string, TopProduct>()
  for (const item of items) {
    if (cancelledIds.has(item.order_id)) continue
    const name = (item.product_name ?? '').trim() || 'Produk tanpa nama'
    const qty = Math.max(0, Math.floor(Number(item.qty) || 0))
    const revenue = Math.max(
      0,
      Math.floor(Number(item.subtotal) || Number(item.price) * qty || 0)
    )
    const existing = productMap.get(name)
    if (existing) {
      existing.qty += qty
      existing.revenue += revenue
    } else {
      productMap.set(name, { name, qty, revenue })
    }
  }
  const topProducts = [...productMap.values()]
    .sort((a, b) => b.revenue - a.revenue || b.qty - a.qty)
    .slice(0, 5)

  return {
    gmv,
    paidRevenue,
    orderCount,
    paidOrderCount,
    cancelledCount,
    avgOrderValue: orderCount > 0 ? Math.floor(gmv / orderCount) : 0,
    byStatus,
    daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    topProducts,
  }
}

/** Apakah toko boleh export analitik (hanya Gold & tidak terkunci). */
export function canExportAnalytics(
  analyticsExportAllowed: boolean,
  premiumLocked: boolean
): boolean {
  return analyticsExportAllowed && !premiumLocked
}

function csvEscape(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/** CSV analitik: ringkasan harian + produk terlaris (BOM untuk Excel). */
export function buildAnalyticsCsv(
  summary: AnalyticsSummary,
  rangeLabel: string,
  storeSlug: string
): { filename: string; csv: string } {
  const stamp = new Date().toISOString().slice(0, 10)
  const lines: string[] = []
  lines.push(`Analitik toko ${storeSlug} — ${rangeLabel}`)
  lines.push('')
  lines.push('Tanggal,Jumlah Order,GMV (Rp),Lunas (Rp)')
  for (const d of summary.daily) {
    lines.push([d.date, d.orders, d.gmv, d.paid].map(csvEscape).join(','))
  }
  lines.push('')
  lines.push('Produk Terlaris')
  lines.push('Produk,Terjual,Pendapatan (Rp)')
  for (const p of summary.topProducts) {
    lines.push([p.name, p.qty, p.revenue].map(csvEscape).join(','))
  }
  lines.push('')
  lines.push(`Total GMV (Rp),${summary.gmv}`)
  lines.push(`Total Lunas (Rp),${summary.paidRevenue}`)
  lines.push(`Rata-rata Order (Rp),${summary.avgOrderValue}`)
  return {
    filename: `analitik-${storeSlug}-${stamp}.csv`,
    csv: '\uFEFF' + lines.join('\n'),
  }
}
