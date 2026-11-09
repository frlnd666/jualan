// Manajemen pesanan lanjutan (Fase 3):
//   - update status massal (bulk) — tiap order divalidasi terhadap
//     ALLOWED_TRANSITIONS yang sama dengan update tunggal;
//   - catatan internal seller per order (seller_note, bukan catatan
//     customer);
//   - export order CSV untuk seller.
//
// Semua aksi owner/staff (getDashboardAccess, Fase 2) — staff boleh,
// karena pesanan memang ranah staff. Input resi tetap di
// order-fulfillment.ts (saveShipmentAction) dan tidak diduplikat di sini.

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createPublicInvoiceClient } from '@/lib/invoice-access'
import { getDashboardAccess } from '@/lib/dashboard-access'
import {
  ALLOWED_TRANSITIONS,
  restoreStock,
} from '@/lib/actions/order-fulfillment'
import { notifyOrderEvent } from '@/lib/notify'
import type { NotificationType } from '@/lib/notifications'
import type { OrderStatus } from '@/lib/types/order'

export interface ActionResult {
  success: boolean
  error?: string
}

const ORDER_STATUSES: OrderStatus[] = [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'COMPLETED',
  'CANCELLED',
]

function statusToNotificationType(
  status: OrderStatus
): NotificationType | null {
  switch (status) {
    case 'PAID':
    case 'PROCESSING':
      return 'ORDER_PAID'
    case 'SHIPPED':
      return 'ORDER_SHIPPED'
    case 'COMPLETED':
      return 'ORDER_COMPLETED'
    case 'CANCELLED':
      return 'ORDER_CANCELLED'
    default:
      return null
  }
}

export interface BulkUpdateResult {
  success: boolean
  updated: number
  failed: Array<{ orderId: string; error: string }>
  error?: string
}

/**
 * Ubah status banyak order sekaligus. Setiap order dicek satu per satu:
 * milik toko ini + transisi diizinkan. Order yang gagal tidak
 * menggagalkan yang lain — hasilnya dirinci per order.
 */
export async function bulkUpdateOrderStatusAction(
  formData: FormData
): Promise<BulkUpdateResult> {
  const rawIds = String(formData.get('orderIds') ?? '')
  const nextStatus = String(formData.get('status') ?? '').trim() as OrderStatus

  let orderIds: string[] = []
  try {
    const parsed: unknown = JSON.parse(rawIds)
    if (Array.isArray(parsed)) {
      orderIds = parsed.filter((v): v is string => typeof v === 'string')
    }
  } catch {
    orderIds = []
  }

  if (!orderIds.length) {
    return { success: false, updated: 0, failed: [], error: 'Tidak ada pesanan dipilih.' }
  }
  if (orderIds.length > 100) {
    return { success: false, updated: 0, failed: [], error: 'Maksimal 100 pesanan sekali proses.' }
  }
  if (!ORDER_STATUSES.includes(nextStatus)) {
    return { success: false, updated: 0, failed: [], error: 'Status tujuan tidak dikenal.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, updated: 0, failed: [], error: 'Kamu harus login.' }
  }

  const access = await getDashboardAccess(supabase, user.id)
  if (!access) {
    return { success: false, updated: 0, failed: [], error: 'Toko tidak ditemukan untuk akun ini.' }
  }
  const store = access.store

  interface BulkOrderRow {
    id: string
    store_id: string
    status: OrderStatus
    customer_name: string
    customer_phone: string | null
    total: number
    buyer_id: string | null
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('id, store_id, status, customer_name, customer_phone, total, buyer_id')
    .in('id', orderIds)
    .eq('store_id', store.id)

  const foundById = new Map<string, BulkOrderRow>()
  for (const o of (orders ?? []) as BulkOrderRow[]) {
    foundById.set(o.id, o)
  }

  const notifyClient = await createPublicInvoiceClient()
  const failed: Array<{ orderId: string; error: string }> = []
  let updated = 0

  for (const orderId of orderIds) {
    const order = foundById.get(orderId)
    if (!order) {
      failed.push({ orderId, error: 'Pesanan tidak ditemukan di tokomu.' })
      continue
    }
    if (order.status === nextStatus) {
      failed.push({ orderId, error: 'Status sudah seperti itu.' })
      continue
    }
    if (!ALLOWED_TRANSITIONS[order.status]?.includes(nextStatus)) {
      failed.push({
        orderId,
        error: `Tidak bisa diubah dari ${order.status} ke ${nextStatus}.`,
      })
      continue
    }

    const { error } = await supabase
      .from('orders')
      .update({ status: nextStatus })
      .eq('id', order.id)
      .eq('store_id', store.id)
      .eq('status', order.status)

    if (error) {
      failed.push({ orderId, error: 'Gagal mengubah status.' })
      continue
    }

    if (nextStatus === 'CANCELLED') {
      await restoreStock(supabase, order.id)
    }
    updated += 1

    // Notifikasi best-effort (tidak boleh menggagalkan bulk update):
    // in-app + email + WhatsApp lewat dispatcher terpusat.
    const notifType = statusToNotificationType(nextStatus)
    if (notifType) {
      void notifyOrderEvent(
        notifyClient,
        {
          ownerId: store.owner_id,
          buyerId: order.buyer_id,
          storeId: store.id,
          orderId: order.id,
          invoiceNumber: '',
          customerName: order.customer_name,
          total: Number(order.total),
        },
        notifType,
        store.name,
        { buyerPhone: order.customer_phone }
      )
    }
  }

  revalidatePath('/dashboard/orders')
  return { success: updated > 0, updated, failed }
}

export async function saveSellerNoteAction(
  formData: FormData
): Promise<ActionResult> {
  const orderId = String(formData.get('orderId') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim()

  if (!orderId) return { success: false, error: 'ID pesanan tidak valid.' }
  if (note.length > 500) {
    return { success: false, error: 'Catatan maksimal 500 karakter.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Kamu harus login.' }

  const access = await getDashboardAccess(supabase, user.id)
  if (!access) return { success: false, error: 'Toko tidak ditemukan untuk akun ini.' }

  const { error } = await supabase
    .from('orders')
    .update({ seller_note: note || null })
    .eq('id', orderId)
    .eq('store_id', access.store.id)

  if (error) return { success: false, error: 'Gagal menyimpan catatan.' }
  revalidatePath(`/dashboard/orders/${orderId}`)
  return { success: true }
}

// --- Export CSV -----------------------------------------------------------

function csvEscape(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const CSV_HEADERS = [
  'Tanggal',
  'Invoice',
  'Customer',
  'WhatsApp',
  'Subtotal',
  'Diskon',
  'Ongkir',
  'Total',
  'Status Order',
  'Status Bayar',
  'Metode Bayar',
  'Voucher',
  'Kurir',
  'Resi',
]

export async function exportOrdersCsvAction(input: {
  tab?: string
}): Promise<{ success: true; filename: string; csv: string } | { success: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Kamu harus login.' }

  const access = await getDashboardAccess(supabase, user.id)
  if (!access) return { success: false, error: 'Toko tidak ditemukan untuk akun ini.' }
  const store = access.store

  const { data: orders } = await supabase
    .from('orders')
    .select(
      'id, customer_name, customer_phone, subtotal, discount_amount, shipping_cost, total, status, payment_method, shipping_method_name, voucher_code, created_at'
    )
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .limit(1000)

  const rows = (orders ?? []) as Array<{
    id: string
    customer_name: string
    customer_phone: string | null
    subtotal: number
    discount_amount: number | null
    shipping_cost: number
    total: number
    status: string
    payment_method: string
    shipping_method_name: string | null
    voucher_code: string | null
    created_at: string
  }>

  const { data: invoices } = rows.length
    ? await supabase
        .from('invoices')
        .select('order_id, invoice_number, payment_status')
        .in(
          'order_id',
          rows.map((o) => o.id)
        )
    : { data: [] }
  const invoiceByOrder = new Map<string, { invoice_number: string; payment_status: string }>()
  for (const inv of (invoices ?? []) as Array<{ order_id: string; invoice_number: string; payment_status: string }>) {
    invoiceByOrder.set(inv.order_id, inv)
  }

  const { data: shipments } = rows.length
    ? await supabase
        .from('shipments')
        .select('order_id, courier, tracking_number')
        .in(
          'order_id',
          rows.map((o) => o.id)
        )
    : { data: [] }
  const shipmentByOrder = new Map<string, { courier: string; tracking_number: string }>()
  for (const s of (shipments ?? []) as Array<{ order_id: string; courier: string; tracking_number: string }>) {
    shipmentByOrder.set(s.order_id, s)
  }

  // Filter tab sama seperti halaman daftar (dipakai bila seller export
  // dari tab tertentu); 'semua'/kosong = semua order.
  const tab = input.tab ?? 'semua'
  const visible = rows.filter((o) => {
    if (tab === 'semua') return true
    const inv = invoiceByOrder.get(o.id)
    if (tab === 'batal') return o.status === 'CANCELLED'
    if (tab === 'selesai') return o.status === 'COMPLETED'
    if (tab === 'dikirim') return o.status === 'SHIPPED'
    if (tab === 'perlu-verifikasi') return inv?.payment_status === 'WAITING_VERIFICATION'
    if (tab === 'perlu-dikirim') return o.status === 'PAID' || o.status === 'PROCESSING'
    if (tab === 'belum-bayar') return o.status === 'PENDING_PAYMENT'
    return true
  })

  const lines = [CSV_HEADERS.join(',')]
  for (const o of visible) {
    const inv = invoiceByOrder.get(o.id)
    const ship = shipmentByOrder.get(o.id)
    lines.push(
      [
        new Date(o.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
        inv?.invoice_number ?? '',
        o.customer_name,
        o.customer_phone ?? '',
        o.subtotal,
        o.discount_amount ?? 0,
        o.shipping_cost,
        o.total,
        o.status,
        inv?.payment_status ?? '',
        o.payment_method,
        o.voucher_code ?? '',
        ship?.courier ?? o.shipping_method_name ?? '',
        ship?.tracking_number ?? '',
      ]
        .map(csvEscape)
        .join(',')
    )
  }

  const stamp = new Date().toISOString().slice(0, 10)
  return {
    success: true,
    filename: `pesanan-${store.slug}-${stamp}.csv`,
    // BOM supaya Excel membuka sebagai UTF-8.
    csv: '\uFEFF' + lines.join('\n'),
  }
}
