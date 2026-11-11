// Analitik seller — SERVER ACTIONS (Fase 4).
// - Baca ringkasan: owner + staff toko (analitik adalah ranah toko).
// - Export CSV: HANYA Gold (TIER_LIMITS.gold.analyticsExport = true;
//   Silver/Free ditolak server-side dengan pesan jelas).
// Data dari orders / order_items / invoices yang sudah ada — tidak ada
// tabel baru. Perhitungan murni ada di lib/analytics.ts (bisa dites).

'use server'

import { createClient } from '@/lib/supabase/server'
import { getDashboardAccess } from '@/lib/dashboard-access'
import { getStoreSubscription, limitsFor } from '@/lib/subscriptions'
import {
  buildAnalyticsCsv,
  canExportAnalytics,
  computeAnalytics,
  computePeriodTotals,
  deltaPct,
  previousRangeWindow,
  rangeStart,
  type AnalyticsDelta,
  type AnalyticsInvoiceRow,
  type AnalyticsItemRow,
  type AnalyticsOrderRow,
  type AnalyticsRange,
  type AnalyticsSummary,
  type RecentOrder,
} from '@/lib/analytics'

export type AnalyticsResult =
  | {
      summary: AnalyticsSummary
      range: AnalyticsRange
      canExport: boolean
      /** Perubahan vs periode sebelumnya (null semua bila range 'all'). */
      deltas: AnalyticsDelta
      /** 5 pesanan terbaru (status apa pun) untuk kartu ringkasan. */
      recentOrders: RecentOrder[]
    }
  | { error: string }

function isValidRange(value: string): value is AnalyticsRange {
  return value === '7d' || value === '30d' || value === '90d' || value === 'all'
}

async function loadAnalyticsData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string,
  range: AnalyticsRange
): Promise<{
  summary: AnalyticsSummary
  orders: AnalyticsOrderRow[]
  invoices: AnalyticsInvoiceRow[]
}> {
  const now = new Date()
  const start = rangeStart(range, now)
  let ordersQuery = supabase
    .from('orders')
    .select('id, total, status, created_at')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (start) ordersQuery = ordersQuery.gte('created_at', start.toISOString())
  const { data: ordersData } = await ordersQuery
  const orders = (ordersData ?? []) as AnalyticsOrderRow[]

  const orderIds = orders.map((o) => o.id)
  let items: AnalyticsItemRow[] = []
  let invoices: AnalyticsInvoiceRow[] = []
  if (orderIds.length > 0) {
    const { data: itemsData } = await supabase
      .from('order_items')
      .select('order_id, product_name, qty, price, subtotal')
      .in('order_id', orderIds)
    items = (itemsData ?? []) as AnalyticsItemRow[]
    const { data: invoicesData } = await supabase
      .from('invoices')
      .select('order_id, payment_status, invoice_number')
      .in('order_id', orderIds)
    invoices = (invoicesData ?? []) as AnalyticsInvoiceRow[]
  }

  return {
    summary: computeAnalytics(orders, items, invoices, range, now),
    orders,
    invoices,
  }
}

/**
 * Total headline periode sebelumnya — hanya butuh orders + invoices
 * (tanpa item/daily), jadi query-nya lebih ringan dari
 * loadAnalyticsData. Pemanggil membandingkan hasilnya dengan summary
 * periode sekarang lewat deltaPct. Range 'all' tidak punya pembanding
 * (total 0 → delta null di pemanggil).
 */
async function loadPreviousTotals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string,
  range: AnalyticsRange,
  now: Date
): Promise<{
  gmv: number
  paidRevenue: number
  orderCount: number
  avgOrderValue: number
} | null> {
  const window = previousRangeWindow(range, now)
  if (!window) return null
  const { data: ordersData } = await supabase
    .from('orders')
    .select('id, total, status, created_at')
    .eq('store_id', storeId)
    .gte('created_at', window.start.toISOString())
    .lt('created_at', window.end.toISOString())
    .order('created_at', { ascending: false })
    .limit(5000)
  const orders = (ordersData ?? []) as AnalyticsOrderRow[]
  let invoices: AnalyticsInvoiceRow[] = []
  const orderIds = orders.map((o) => o.id)
  if (orderIds.length > 0) {
    const { data: invoicesData } = await supabase
      .from('invoices')
      .select('order_id, payment_status')
      .in('order_id', orderIds)
    invoices = (invoicesData ?? []) as AnalyticsInvoiceRow[]
  }
  return computePeriodTotals(orders, invoices)
}

export async function getSellerAnalyticsAction(
  rangeInput: string
): Promise<AnalyticsResult> {
  const range: AnalyticsRange = isValidRange(rangeInput) ? rangeInput : '30d'
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const access = await getDashboardAccess(supabase, user.id)
  if (!access) return { error: 'Toko tidak ditemukan untuk akun ini.' }
  const store = access.store

  // R-03: gagal baca langganan = fail-closed, terlihat oleh seller.
  let subscription
  try {
    subscription = await getStoreSubscription(supabase, store.id)
  } catch {
    return { error: 'Gagal memeriksa langganan toko. Coba lagi.' }
  }
  const limits = limitsFor(subscription)
  const canExport = canExportAnalytics(
    limits.analyticsExport,
    subscription.status === 'PAST_DUE'
  )

  const { summary, orders, invoices } = await loadAnalyticsData(
    supabase,
    store.id,
    range
  )

  // Delta vs periode sebelumnya (range 'all' → semua null).
  const previous = await loadPreviousTotals(supabase, store.id, range, new Date())
  const deltas: AnalyticsDelta = previous
    ? {
        gmv: deltaPct(summary.gmv, previous.gmv),
        paidRevenue: deltaPct(summary.paidRevenue, previous.paidRevenue),
        orderCount: deltaPct(summary.orderCount, previous.orderCount),
        avgOrderValue: deltaPct(summary.avgOrderValue, previous.avgOrderValue),
      }
    : { gmv: null, paidRevenue: null, orderCount: null, avgOrderValue: null }

  // 5 pesanan terbaru (orders sudah urut terbaru dulu).
  const invoiceNumberByOrder = new Map(
    invoices.map((inv) => [inv.order_id, inv.invoice_number ?? ''])
  )
  const recentOrders: RecentOrder[] = orders.slice(0, 5).map((order) => ({
    id: order.id,
    invoiceNumber: invoiceNumberByOrder.get(order.id) ?? '',
    total: Math.max(0, Math.floor(Number(order.total) || 0)),
    status: String(order.status ?? ''),
    createdAt: order.created_at,
  }))

  // Foto produk terlaris — dicocokkan lewat nama (satu query produk
  // toko; toko paling banyak 175 produk di Gold).
  const { data: productsData } = await supabase
    .from('products')
    .select('name, images')
    .eq('store_id', store.id)
  const imageByName = new Map<string, string | null>()
  for (const p of (productsData ?? []) as Array<{
    name: string | null
    images: string[] | null
  }>) {
    const key = (p.name ?? '').trim().toLowerCase()
    if (key && !imageByName.has(key)) {
      imageByName.set(key, p.images?.[0] ?? null)
    }
  }
  for (const product of summary.topProducts) {
    product.image = imageByName.get(product.name.trim().toLowerCase()) ?? null
  }

  return { summary, range, canExport, deltas, recentOrders }
}

export async function exportAnalyticsCsvAction(
  rangeInput: string
): Promise<
  | { success: true; filename: string; csv: string }
  | { success: false; error: string }
> {
  const range: AnalyticsRange = isValidRange(rangeInput) ? rangeInput : '30d'
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Kamu harus login.' }

  const access = await getDashboardAccess(supabase, user.id)
  if (!access) return { success: false, error: 'Toko tidak ditemukan untuk akun ini.' }
  const store = access.store

  // Export HANYA Gold — ditegakkan di server, bukan hanya di UI.
  // R-03: gagal baca langganan = fail-closed, terlihat oleh seller.
  let subscription
  try {
    subscription = await getStoreSubscription(supabase, store.id)
  } catch {
    return {
      success: false,
      error: 'Gagal memeriksa langganan toko. Coba lagi.',
    }
  }
  const limits = limitsFor(subscription)
  if (
    !canExportAnalytics(
      limits.analyticsExport,
      subscription.status === 'PAST_DUE'
    )
  ) {
    return {
      success: false,
      error:
        'Export analitik hanya untuk paket Gold. Upgrade paketmu di halaman Langganan untuk memakai fitur ini.',
    }
  }

  const { summary } = await loadAnalyticsData(supabase, store.id, range)
  const rangeLabel =
    range === '7d'
      ? '7 hari terakhir'
      : range === '30d'
        ? '30 hari terakhir'
        : range === '90d'
          ? '90 hari terakhir'
          : 'Semua waktu'
  const { filename, csv } = buildAnalyticsCsv(summary, rangeLabel, store.slug)
  return { success: true, filename, csv }
}
