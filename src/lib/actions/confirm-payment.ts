'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createPublicInvoiceClient } from '@/lib/invoice-access'
import { getDashboardAccess } from '@/lib/dashboard-access'
import { notifyOrderEvent } from '@/lib/notify'
import { logAudit } from '@/lib/audit'
import { logEvent } from '@/lib/observability'
// Diagnostik sementara 2026-11-09 (hapus setelah akar masalah ketemu):
// aksi seller menggantung — lihat src/lib/action-timeout.ts.
import {
  createStepTracker,
  DIAGNOSTIC_TIMEOUT_MS,
  withActionTimeout,
} from '@/lib/action-timeout'

export async function confirmPayment(
  formData: FormData
): Promise<{ success?: string; error?: string }> {
  const invoiceId = String(formData.get('invoiceId') || '')
  const orderId = String(formData.get('orderId') || '')
  const invoiceNumber = String(formData.get('invoiceNumber') || '')

  if (!invoiceId || !orderId || !invoiceNumber) {
    return { error: 'Data pembayaran tidak lengkap.' }
  }

  // Diagnostik sementara 2026-11-09: catat langkah terakhir + batas waktu
  // agar langkah yang menggantung terlihat dari UI (hapus setelah fix).
  const tracker = createStepTracker()
  const run = (async () => {
    tracker.set('createClient')
    const supabase = await createClient()

  // Server Action bisa dipanggil lewat POST langsung di luar UI (panduan
  // keamanan data Next.js), jadi autentikasi + otorisasi WAJIB dicek ulang
  // di dalam action — cek login di halaman dashboard saja tidak cukup.
  tracker.set('auth.getUser')
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Kamu harus login untuk mengonfirmasi pembayaran.' }
  }

  tracker.set('baca invoices')
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, order_id, payment_status, payment_proof_url')
    .eq('id', invoiceId)
    .eq('invoice_number', invoiceNumber)
    .maybeSingle()

  if (invoiceError || !invoice) {
    return { error: 'Invoice tidak ditemukan.' }
  }

  // Pasangan invoice <-> order harus cocok persis; mencegah pencampuran id
  // order lain untuk mengubah status di luar kepemilikan pemanggil.
  if (invoice.order_id !== orderId) {
    return { error: 'Data pembayaran tidak cocok dengan order.' }
  }

  tracker.set('baca orders')
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, store_id, payment_method, customer_name, customer_phone, total, buyer_id')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError || !order) {
    return { error: 'Order tidak ditemukan.' }
  }

  // Hanya pemilik toko dari order ini — atau staff toko itu (Fase 2) —
  // yang boleh mengonfirmasi.
  tracker.set('getDashboardAccess')
  const access = await getDashboardAccess(supabase, user.id)
  if (!access || access.store.id !== order.store_id) {
    return { error: 'Kamu tidak berhak mengonfirmasi pembayaran order ini.' }
  }
  const ownedStore = access.store

  // Fase 1 (Bab 5 rencana SaaS): COD tidak punya bukti transfer — penjual
  // menandai pembayaran COD sebagai diterima tanpa unggahan bukti. Syarat
  // bukti HANYA berlaku untuk BANK_TRANSFER / QRIS, yang memang dibayar
  // lewat transfer dan dibuktikan dengan foto.
  const isCod = order.payment_method === 'COD'
  if (!isCod && !invoice.payment_proof_url) {
    return { error: 'Bukti transfer belum diupload customer.' }
  }

  if (invoice.payment_status === 'PAID') {
    return { error: 'Pembayaran ini sudah dikonfirmasi sebelumnya.' }
  }

  tracker.set('update invoices PAID')
  const { error: invoiceUpdateError } = await supabase
    .from('invoices')
    .update({
      payment_status: 'PAID',
    })
    .eq('id', invoiceId)

  if (invoiceUpdateError) {
    return { error: 'Gagal mengubah status invoice.' }
  }

  tracker.set('update orders PROCESSING')
  const { error: orderUpdateError } = await supabase
    .from('orders')
    .update({
      status: 'PROCESSING',
    })
    .eq('id', orderId)
    .eq('store_id', ownedStore.id)

  if (orderUpdateError) {
    return { error: 'Invoice berhasil diubah, tapi status order gagal diperbarui.' }
  }

  // Pembayaran terkonfirmasi → beri tahu pembeli (login/tamu) + pemilik
  // toko lewat in-app + email + WhatsApp. Fire-and-forget: dispatcher
  // tidak pernah melempar dan tidak boleh memperlambat konfirmasi.
  tracker.set('notifikasi ORDER_PAID')
  try {
    const buyerId = (order as { buyer_id?: string | null }).buyer_id ?? null
    const notifyClient = await createPublicInvoiceClient()
    void notifyOrderEvent(
      notifyClient,
      {
        ownerId: ownedStore.owner_id,
        buyerId,
        storeId: ownedStore.id,
        orderId,
        invoiceNumber,
        customerName: (order as { customer_name?: string }).customer_name ?? 'Customer',
        total: Number((order as { total?: number }).total ?? 0),
      },
      'ORDER_PAID',
      ownedStore.name,
      {
        buyerPhone:
          (order as { customer_phone?: string | null }).customer_phone ?? null,
      }
    )
  } catch {}

  // Fase 4 — audit log + jejak terstruktur (best-effort).
  tracker.set('logAudit')
  await logAudit({
    actorId: user.id,
    actorRole: access.role === 'staff' ? 'staff' : 'seller',
    storeId: ownedStore.id,
    action: 'payment_confirmed',
    entityType: 'invoice',
    entityId: invoiceId,
    details: {
      invoice_number: invoiceNumber,
      order_id: orderId,
      payment_method: order.payment_method,
      total: Number(order.total),
    },
  })
  logEvent('payment_confirmed', {
    orderId,
    invoiceNumber,
    storeId: ownedStore.id,
    paymentMethod: order.payment_method,
    total: Number(order.total),
  })

  tracker.set('revalidatePath')
  revalidatePath('/dashboard/payments')
  revalidatePath('/dashboard/orders')
  revalidatePath(`/invoice/${invoiceNumber}`)
  revalidatePath(`/track/${invoiceNumber}`)

  return { success: 'Pembayaran berhasil dikonfirmasi.' }
  })()

  try {
    return await withActionTimeout(run, DIAGNOSTIC_TIMEOUT_MS, tracker)
  } catch (e) {
    return {
      error: `Diagnostik: ${e instanceof Error ? e.message : 'timeout'}`,
    }
  }
}
