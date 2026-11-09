'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPublicInvoiceClient } from '@/lib/invoice-access'
import { getDashboardAccess } from '@/lib/dashboard-access'
import { notifyOrderEvent } from '@/lib/notify'
import { logAudit } from '@/lib/audit'
import { logEvent } from '@/lib/observability'

export async function confirmPayment(formData: FormData) {
  const invoiceId = String(formData.get('invoiceId') || '')
  const orderId = String(formData.get('orderId') || '')
  const invoiceNumber = String(formData.get('invoiceNumber') || '')

  if (!invoiceId || !orderId || !invoiceNumber) {
    return { error: 'Data pembayaran tidak lengkap.' }
  }

  const supabase = await createClient()

  // Server Action bisa dipanggil lewat POST langsung di luar UI (panduan
  // keamanan data Next.js), jadi autentikasi + otorisasi WAJIB dicek ulang
  // di dalam action — cek login di halaman dashboard saja tidak cukup.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Kamu harus login untuk mengonfirmasi pembayaran.' }
  }

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

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, store_id, status, payment_method, customer_name, customer_phone, total, buyer_id')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError || !order) {
    return { error: 'Order tidak ditemukan.' }
  }

  // Hanya pemilik toko dari order ini — atau staff toko itu (Fase 2) —
  // yang boleh mengonfirmasi.
  const access = await getDashboardAccess(supabase, user.id)
  if (!access || access.store.id !== order.store_id) {
    return { error: 'Kamu tidak berhak mengonfirmasi pembayaran order ini.' }
  }
  const ownedStore = access.store

  // Tulis status orders/invoices HANYA lewat service_role: setelah migrasi
  // lockdown (20261109_p0_order_write_lockdown.sql) peran authenticated
  // tidak lagi punya hak UPDATE atas kedua tabel ini, jadi client anon
  // di atas hanya dipakai untuk baca + verifikasi kepemilikan.
  const admin = createAdminClient()
  if (!admin) {
    return { error: 'Server belum dikonfigurasi (service role belum diset).' }
  }

  if (invoice.payment_status === 'PAID') {
    // Cabang ini di atas cek bukti & cek status order: invoice yang sudah
    // PAID lewat webhook QRIS tidak punya payment_proof_url, jadi cek bukti
    // di bawah akan menolaknya mentah — padahal yang dibutuhkan di sini
    // hanyalah sinkronisasi order (P1-25). Gagal-separuh dari alur lama:
    // invoice sudah PAID tapi order masih PENDING_PAYMENT (update order
    // sempat gagal). Perbaiki dulu lewat admin — best-effort, hasilnya
    // tidak mengubah penolakan di bawah — supaya order tidak selamanya
    // menggantung belum dibayar.
    if (order.status === 'PENDING_PAYMENT') {
      await admin
        .from('orders')
        .update({ status: 'PROCESSING' })
        .eq('id', orderId)
        .eq('store_id', ownedStore.id)
        .eq('status', 'PENDING_PAYMENT')
        .select('id')
    }
    return { error: 'Pembayaran ini sudah dikonfirmasi sebelumnya.' }
  }

  // Order yang sudah maju dari PENDING_PAYMENT (diproses, dikirim,
  // selesai, batal) tidak bisa lagi dikonfirmasi pembayarannya — status
  // bayar mengikuti invoice, bukan sebaliknya.
  if (order.status !== 'PENDING_PAYMENT') {
    return { error: `Order ini sudah berstatus ${order.status} sehingga pembayaran tidak bisa dikonfirmasi.` }
  }

  // Fase 1 (Bab 5 rencana SaaS): COD tidak punya bukti transfer — penjual
  // menandai pembayaran COD sebagai diterima tanpa unggahan bukti. Syarat
  // bukti HANYA berlaku untuk BANK_TRANSFER / QRIS, yang memang dibayar
  // lewat transfer dan dibuktikan dengan foto.
  const isCod = order.payment_method === 'COD'
  if (!isCod && !invoice.payment_proof_url) {
    return { error: 'Bukti transfer belum diupload customer.' }
  }

  // Guard atomik: hanya invoice yang masih menunggu (belum dibayar /
  // menunggu verifikasi) yang boleh ditandai lunas. Bila tidak ada baris
  // yang cocok, invoice sudah diproses proses lain di antaranya.
  const { data: invoiceUpdated, error: invoiceUpdateError } = await admin
    .from('invoices')
    .update({
      payment_status: 'PAID',
    })
    .eq('id', invoiceId)
    .in('payment_status', ['PENDING_PAYMENT', 'WAITING_VERIFICATION'])
    .select('id')

  if (invoiceUpdateError) {
    return { error: 'Gagal mengubah status invoice.' }
  }
  if (!invoiceUpdated || invoiceUpdated.length === 0) {
    return { error: 'Pembayaran ini sudah diproses atau statusnya berubah. Coba muat ulang halaman.' }
  }

  // Guard atomik yang sama untuk order: hanya order yang masih
  // PENDING_PAYMENT yang boleh maju ke PROCESSING.
  const { data: orderUpdated, error: orderUpdateError } = await admin
    .from('orders')
    .update({
      status: 'PROCESSING',
    })
    .eq('id', orderId)
    .eq('store_id', ownedStore.id)
    .eq('status', 'PENDING_PAYMENT')
    .select('id')

  if (orderUpdateError) {
    return { error: 'Invoice berhasil diubah, tapi status order gagal diperbarui.' }
  }
  if (!orderUpdated || orderUpdated.length === 0) {
    // Gagal-separuh: invoice sudah PAID tapi order tidak berubah (status
    // order berubah di antara baca dan tulis). Jujur ke seller, jangan
    // kirim notifikasi/audit seolah konfirmasi berhasil penuh, dan catat
    // supaya terlihat di observability untuk diperbaiki manual.
    logEvent('payment_confirm_half_applied', { orderId, invoiceNumber })
    return { error: 'Order sudah berubah status sehingga pembayaran tidak bisa dikonfirmasi. Invoice sudah ditandai lunas — hubungi admin platform.' }
  }

  // Pembayaran terkonfirmasi → beri tahu pembeli (login/tamu) + pemilik
  // toko lewat in-app + email + WhatsApp. Fire-and-forget: dispatcher
  // tidak pernah melempar dan tidak boleh memperlambat konfirmasi.
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

  revalidatePath('/dashboard/payments')
  revalidatePath('/dashboard/orders')
  revalidatePath(`/invoice/${invoiceNumber}`)
  revalidatePath(`/track/${invoiceNumber}`)

  return { success: 'Pembayaran berhasil dikonfirmasi.' }
}
