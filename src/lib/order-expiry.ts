// Kedaluwarsa order tak terbayar (audit 2026-11-09).
//
// Stok dikurangi atomik saat checkout, dan sebelumnya SATU-SATUNYA
// jalan stok kembali adalah seller membatalkan manual — order hantu
// (pembeli pergi sebelum bayar) mengunci stok produk selamanya.
// Job ini membatalkan order PENDING_PAYMENT yang lebih tua dari
// ORDER_EXPIRY_HOURS, KECUALI yang invoice-nya WAITING_VERIFICATION
// (bukti sudah masuk, sedang menunggu seller — membatalkan itu
// berarti menghanguskan uang pembeli yang patuh).
//
// Efek batal memakai applyCancellationEffects yang sama dengan jalur
// manual: stok kembali + kuota voucher lepas + invoice REFUNDED bila
// sempat lunas. Idempotent: update ber-guard status, jadi balapan
// dengan seller/webhook hanya menghasilkan satu pemenang.

import type { SupabaseClient } from '@supabase/supabase-js'
import { applyCancellationEffects } from '@/lib/actions/order-fulfillment'
import { notifyOrderEvent } from '@/lib/notify'
import { logEvent } from '@/lib/observability'

export const ORDER_EXPIRY_HOURS = 24

interface ExpirableOrder {
  id: string
  store_id: string
  customer_name: string
  customer_phone: string | null
  total: number
  buyer_id: string | null
}

export interface OrderExpirySummary {
  processed: number
  cancelled: number
  skippedProofPending: number
  errors: number
}

export async function runOrderExpiry(
  admin: SupabaseClient
): Promise<OrderExpirySummary> {
  const summary: OrderExpirySummary = {
    processed: 0,
    cancelled: 0,
    skippedProofPending: 0,
    errors: 0,
  }

  const cutoff = new Date(
    Date.now() - ORDER_EXPIRY_HOURS * 60 * 60 * 1000
  ).toISOString()

  const { data: orders, error } = await admin
    .from('orders')
    .select('id, store_id, customer_name, customer_phone, total, buyer_id')
    .eq('status', 'PENDING_PAYMENT')
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error || !orders) {
    return { ...summary, errors: 1 }
  }

  const orderRows = orders as ExpirableOrder[]
  summary.processed = orderRows.length
  if (orderRows.length === 0) return summary

  // Invoice untuk seluruh batch (status bayar + nomor untuk notifikasi).
  // PENTING (audit 2026-11-10 W-1): error query di sini TIDAK boleh
  // diabaikan — peta kosong berarti perlindungan WAITING_VERIFICATION
  // hilang dan order yang buktinya sedang dicek seller ikut terbatal.
  // Bila query batch gagal, batalkan seluruh run; cron besok mencoba
  // lagi (order belum berubah status apa pun).
  const invoiceByOrder = new Map<
    string,
    { invoice_number: string; payment_status: string }
  >()
  {
    const { data: invoices, error: invoiceError } = await admin
      .from('invoices')
      .select('order_id, invoice_number, payment_status')
      .in(
        'order_id',
        orderRows.map((o) => o.id)
      )
    if (invoiceError || !invoices) {
      logEvent('order_expiry_aborted', { reason: 'invoice_query_failed' })
      return { ...summary, errors: 1 }
    }
    for (const inv of invoices as Array<{
      order_id: string
      invoice_number: string
      payment_status: string
    }>) {
      invoiceByOrder.set(inv.order_id, {
        invoice_number: inv.invoice_number,
        payment_status: inv.payment_status,
      })
    }
  }

  // Info toko untuk notifikasi (owner + nama), satu query per batch.
  // Query ini hanya untuk notifikasi — kegagalannya tidak menghentikan
  // pembatalan (notifikasi dilewati), tapi tercatat di log.
  const storeById = new Map<string, { owner_id: string; name: string }>()
  {
    const { data: stores, error: storeError } = await admin
      .from('stores')
      .select('id, owner_id, name')
      .in(
        'id',
        [...new Set(orderRows.map((o) => o.store_id))]
      )
    if (storeError) {
      logEvent('order_expiry_store_lookup_failed', {})
    }
    for (const store of (stores ?? []) as Array<{
      id: string
      owner_id: string
      name: string
    }>) {
      storeById.set(store.id, { owner_id: store.owner_id, name: store.name })
    }
  }

  for (const order of orderRows) {
    try {
      const invoice = invoiceByOrder.get(order.id)
      if (invoice?.payment_status === 'WAITING_VERIFICATION') {
        summary.skippedProofPending += 1
        continue
      }

      // Guard atomik: hanya proses yang menang yang menjalankan efek.
      const { data: updated, error: updateError } = await admin
        .from('orders')
        .update({ status: 'CANCELLED' })
        .eq('id', order.id)
        .eq('status', 'PENDING_PAYMENT')
        .select('id')
      if (updateError) {
        summary.errors += 1
        continue
      }
      if (!updated || updated.length === 0) continue

      // Client admin dipakai juga sebagai client stok: RPC
      // increment_stock mengecualikan service_role dari cek pemilik.
      await applyCancellationEffects(
        admin,
        admin as never,
        order.id
      )
      summary.cancelled += 1

      const store = storeById.get(order.store_id)
      if (store) {
        void notifyOrderEvent(
          admin,
          {
            ownerId: store.owner_id,
            buyerId: order.buyer_id,
            storeId: order.store_id,
            orderId: order.id,
            invoiceNumber: invoice?.invoice_number ?? '',
            customerName: order.customer_name,
            total: Number(order.total),
          },
          'ORDER_CANCELLED',
          store.name,
          { buyerPhone: order.customer_phone }
        )
      }
    } catch {
      summary.errors += 1
    }
  }

  return summary
}
