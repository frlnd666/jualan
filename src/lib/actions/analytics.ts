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
  rangeStart,
  type AnalyticsInvoiceRow,
  type AnalyticsItemRow,
  type AnalyticsOrderRow,
  type AnalyticsRange,
  type AnalyticsSummary,
} from '@/lib/analytics'

export type AnalyticsResult =
  | { summary: AnalyticsSummary; range: AnalyticsRange; canExport: boolean }
  | { error: string }

function isValidRange(value: string): value is AnalyticsRange {
  return value === '7d' || value === '30d' || value === '90d' || value === 'all'
}

async function loadAnalyticsData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string,
  range: AnalyticsRange
): Promise<AnalyticsSummary> {
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
      .select('order_id, payment_status')
      .in('order_id', orderIds)
    invoices = (invoicesData ?? []) as AnalyticsInvoiceRow[]
  }

  return computeAnalytics(orders, items, invoices, range, now)
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

  const subscription = await getStoreSubscription(supabase, store.id)
  const limits = limitsFor(subscription)
  const canExport = canExportAnalytics(
    limits.analyticsExport,
    subscription.status === 'PAST_DUE'
  )

  const summary = await loadAnalyticsData(supabase, store.id, range)
  return { summary, range, canExport }
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
  const subscription = await getStoreSubscription(supabase, store.id)
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

  const summary = await loadAnalyticsData(supabase, store.id, range)
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
