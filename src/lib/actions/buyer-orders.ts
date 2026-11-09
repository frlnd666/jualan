'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPublicInvoiceClient } from '@/lib/invoice-access'
import { settleCodInvoiceOnComplete } from '@/lib/actions/order-fulfillment'
import { notifyOrderEvent } from '@/lib/notify'

export interface BuyerActionResult {
  success: boolean
  error?: string
}

/**
 * Pembeli mengonfirmasi pesanan sudah diterima: SHIPPED → COMPLETED.
 *
 * Audit 2026-11-09: sebelumnya COMPLETED hanya bisa dipicu seller —
 * order berhenti selamanya di SHIPPED bila seller lupa menandai
 * selesai, dan tab "selesai"/analitik kekurangan data. Kepemilikan
 * ditegakkan dua lapis: query dibatasi buyer_id = user login, dan
 * update atomik ber-guard status SHIPPED lewat service_role (peran
 * authenticated tidak punya hak UPDATE status sejak lockdown).
 * Order COD yang selesai di sini invoice-nya ikut lunas (uang tunai
 * diterima bersama barang).
 */
export async function confirmOrderReceivedAction(
  orderId: string
): Promise<BuyerActionResult> {
  if (!orderId) return { success: false, error: 'ID pesanan tidak valid.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Kamu harus login.' }

  const { data: order } = await supabase
    .from('orders')
    .select(
      'id, store_id, status, customer_name, customer_phone, total, buyer_id, payment_method'
    )
    .eq('id', orderId)
    .eq('buyer_id', user.id)
    .maybeSingle()

  if (!order) return { success: false, error: 'Pesanan tidak ditemukan.' }

  const ord = order as {
    id: string
    store_id: string
    status: string
    customer_name: string
    customer_phone: string | null
    total: number
    buyer_id: string | null
    payment_method: string | null
  }

  if (ord.status !== 'SHIPPED') {
    return {
      success: false,
      error: 'Pesanan belum dikirim atau sudah selesai.',
    }
  }

  const admin = createAdminClient()
  if (!admin) {
    return {
      success: false,
      error: 'Server belum dikonfigurasi (service role belum diset).',
    }
  }

  const { data: updated, error } = await admin
    .from('orders')
    .update({ status: 'COMPLETED' })
    .eq('id', ord.id)
    .eq('buyer_id', user.id)
    .eq('status', 'SHIPPED')
    .select('id')

  if (error) return { success: false, error: 'Gagal menyelesaikan pesanan.' }
  if (!updated || updated.length === 0) {
    return {
      success: false,
      error: 'Status pesanan sudah berubah. Muat ulang halaman lalu coba lagi.',
    }
  }

  if (ord.payment_method === 'COD') {
    await settleCodInvoiceOnComplete(admin, ord.id)
  }

  // Notifikasi selesai ke seller + pembeli (best-effort).
  try {
    const { data: store } = await supabase
      .from('stores')
      .select('id, name, owner_id')
      .eq('id', ord.store_id)
      .maybeSingle()
    const storeRow = store as {
      id: string
      name: string
      owner_id: string
    } | null
    if (storeRow) {
      const notifyClient = await createPublicInvoiceClient()
      let invoiceNumber = ''
      try {
        const { data: invoice } = await notifyClient
          .from('invoices')
          .select('invoice_number')
          .eq('order_id', ord.id)
          .maybeSingle()
        invoiceNumber =
          (invoice as { invoice_number: string } | null)?.invoice_number ?? ''
      } catch {}
      void notifyOrderEvent(
        notifyClient,
        {
          ownerId: storeRow.owner_id,
          buyerId: ord.buyer_id,
          storeId: storeRow.id,
          orderId: ord.id,
          invoiceNumber,
          customerName: ord.customer_name,
          total: Number(ord.total),
        },
        'ORDER_COMPLETED',
        storeRow.name,
        { buyerPhone: ord.customer_phone }
      )
    }
  } catch {}

  revalidatePath('/akun/pesanan')
  revalidatePath(`/akun/pesanan/${ord.id}`)
  revalidatePath('/dashboard/orders')
  return { success: true }
}
