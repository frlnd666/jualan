'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createPublicInvoiceClient } from '@/lib/invoice-access'
import { getDashboardAccess } from '@/lib/dashboard-access'
import { notifyOrderEvent } from '@/lib/notify'
import type { NotificationType } from '@/lib/notifications'
import type { OrderStatus } from '@/lib/types/order'

export interface ActionResult {
  success: boolean
  error?: string
}

/**
 * Transisi status order yang boleh dilakukan seller dari dashboard.
 * Status terminal (COMPLETED, CANCELLED) tidak punya transisi keluar.
 * Diekspor untuk dipakai bulk update (order-management.ts) — satu sumber
 * kebenaran, bukan duplikat aturan.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['CANCELLED'],
  PAID: ['PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'COMPLETED', 'CANCELLED'],
  SHIPPED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
}

const ORDER_STATUSES: OrderStatus[] = [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'COMPLETED',
  'CANCELLED',
]

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/** Verifikasi: user login, punya akses ke toko (pemilik ATAU staff —
// Fase 2), dan order ini milik toko itu. */
async function getOwnedOrder(supabase: SupabaseServerClient, orderId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Sesi login tidak ditemukan. Silakan login ulang.' as const }
  }

  const access = await getDashboardAccess(supabase, user.id)
  if (!access) {
    return { error: 'Toko tidak ditemukan untuk akun ini.' as const }
  }
  const store = access.store

  const { data: order } = await supabase
    .from('orders')
    .select('id, store_id, status, customer_name, customer_phone, total, buyer_id')
    .eq('id', orderId)
    .eq('store_id', store.id)
    .maybeSingle()

  if (!order) {
    return { error: 'Pesanan tidak ditemukan.' as const }
  }

  return { order, store }
}

/** Kembalikan stok produk untuk semua item order (dipakai saat order dibatalkan).
 *  Diekspor untuk dipakai bulk update (order-management.ts). */
export async function restoreStock(supabase: SupabaseServerClient, orderId: string) {
  const { data: items } = await supabase
    .from('order_items')
    .select('product_id, qty')
    .eq('order_id', orderId)

  for (const item of items ?? []) {
    if (!item.product_id) continue
    const qty = Number(item.qty ?? 0)
    if (qty < 1) continue

    // RPC atomik (tambah qty); kepemilikan toko dicek di dalam fungsi
    // untuk pemanggil ber-JWT, jadi seller hanya bisa mengembalikan stok
    // produk tokonya sendiri. Sebelumnya baca-ubah-tulis dari kode
    // (update stock = nilai_baca + qty) bisa menimpa perubahan bersamaan.
    // Kegagalan di sini best-effort: order sudah terlanjur CANCELLED.
    await supabase.rpc('increment_stock', {
      p_product_id: item.product_id,
      p_qty: qty,
    })
  }
}

function statusToNotificationType(status: OrderStatus): NotificationType | null {
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

/**
 * Beri tahu pemilik toko + pembeli saat status berubah: in-app + email +
 * WhatsApp lewat dispatcher terpusat. Fire-and-forget — tidak boleh
 * menggagalkan update status.
 */
async function notifyOrderChange(
  order: {
    id: string
    customer_name: string
    customer_phone: string | null
    total: number
    buyer_id: string | null
  },
  store: { id: string; name: string; owner_id: string },
  nextStatus: OrderStatus,
  shipment?: { trackingNumber: string; courier: string }
): Promise<void> {
  const type = statusToNotificationType(nextStatus)
  if (!type) return
  try {
    const notifyClient = await createPublicInvoiceClient()
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
      type,
      store.name,
      {
        trackingNumber: shipment?.trackingNumber ?? null,
        courier: shipment?.courier ?? null,
        buyerPhone: order.customer_phone,
      }
    )
  } catch {}
}

export async function updateOrderStatusAction(
  formData: FormData
): Promise<ActionResult> {
  const orderId = String(formData.get('orderId') ?? '').trim()
  const nextStatus = String(formData.get('status') ?? '').trim() as OrderStatus

  if (!orderId) return { success: false, error: 'ID pesanan tidak valid.' }
  if (!ORDER_STATUSES.includes(nextStatus)) {
    return { success: false, error: 'Status tujuan tidak dikenal.' }
  }

  const supabase = await createClient()
  const owned = await getOwnedOrder(supabase, orderId)
  if ('error' in owned) return { success: false, error: owned.error }

  const currentStatus = owned.order.status as OrderStatus

  if (currentStatus === nextStatus) {
    return { success: false, error: 'Status pesanan sudah seperti itu.' }
  }

  if (!ALLOWED_TRANSITIONS[currentStatus]?.includes(nextStatus)) {
    return {
      success: false,
      error: `Status tidak bisa diubah dari ${currentStatus} ke ${nextStatus}.`,
    }
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: nextStatus })
    .eq('id', owned.order.id)
    .eq('store_id', owned.order.store_id)
    .eq('status', currentStatus)

  if (updateError) {
    return { success: false, error: 'Gagal mengubah status pesanan.' }
  }

  // Stok sudah dikurangi saat checkout; batal = kembalikan.
  if (nextStatus === 'CANCELLED') {
    await restoreStock(supabase, owned.order.id)
  }

  // Fase 3: notifikasi in-app ke pemilik toko + pembeli login.
  await notifyOrderChange(owned.order, owned.store, nextStatus)

  revalidatePath('/dashboard/orders')
  revalidatePath(`/dashboard/orders/${owned.order.id}`)
  return { success: true }
}

export async function saveShipmentAction(
  formData: FormData
): Promise<ActionResult> {
  const orderId = String(formData.get('orderId') ?? '').trim()
  const courier = String(formData.get('courier') ?? '').trim()
  const trackingNumber = String(formData.get('trackingNumber') ?? '').trim()

  if (!orderId) return { success: false, error: 'ID pesanan tidak valid.' }
  if (!courier) return { success: false, error: 'Nama kurir wajib diisi.' }
  if (!trackingNumber) return { success: false, error: 'Nomor resi wajib diisi.' }

  const supabase = await createClient()
  const owned = await getOwnedOrder(supabase, orderId)
  if ('error' in owned) return { success: false, error: owned.error }

  const currentStatus = owned.order.status as OrderStatus
  if (currentStatus === 'CANCELLED' || currentStatus === 'COMPLETED') {
    return {
      success: false,
      error: 'Pesanan yang sudah selesai/dibatalkan tidak bisa diberi resi.',
    }
  }

  const { data: existing } = await supabase
    .from('shipments')
    .select('id')
    .eq('order_id', owned.order.id)
    .maybeSingle()

  const shipmentError = existing
    ? (
        await supabase
          .from('shipments')
          .update({
            courier,
            tracking_number: trackingNumber,
            status: 'SHIPPED',
            shipped_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
      ).error
    : (
        await supabase.from('shipments').insert({
          order_id: owned.order.id,
          courier,
          tracking_number: trackingNumber,
          status: 'SHIPPED',
          shipped_at: new Date().toISOString(),
        })
      ).error

  if (shipmentError) {
    return { success: false, error: 'Gagal menyimpan data pengiriman.' }
  }

  // Order yang sudah dibayar/diproses otomatis maju ke SHIPPED.
  if (currentStatus === 'PAID' || currentStatus === 'PROCESSING') {
    await supabase
      .from('orders')
      .update({ status: 'SHIPPED' })
      .eq('id', owned.order.id)
      .eq('store_id', owned.order.store_id)
      .eq('status', currentStatus)
  }

  // Fase 3: resi tersimpan = pesanan dikirim — beri tahu pembeli
  // (sertakan nomor resi di email/WA).
  await notifyOrderChange(owned.order, owned.store, 'SHIPPED', {
    trackingNumber,
    courier,
  })

  revalidatePath('/dashboard/orders')
  revalidatePath(`/dashboard/orders/${owned.order.id}`)
  return { success: true }
}
