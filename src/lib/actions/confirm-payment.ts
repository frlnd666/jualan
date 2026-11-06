'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
    .select('id, store_id')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError || !order) {
    return { error: 'Order tidak ditemukan.' }
  }

  // Hanya pemilik toko dari order inilah yang boleh mengonfirmasi.
  const { data: ownedStore, error: storeError } = await supabase
    .from('stores')
    .select('id')
    .eq('id', order.store_id)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (storeError || !ownedStore) {
    return { error: 'Kamu tidak berhak mengonfirmasi pembayaran order ini.' }
  }

  if (!invoice.payment_proof_url) {
    return { error: 'Bukti transfer belum diupload customer.' }
  }

  if (invoice.payment_status === 'PAID') {
    return { error: 'Pembayaran ini sudah dikonfirmasi sebelumnya.' }
  }

  const { error: invoiceUpdateError } = await supabase
    .from('invoices')
    .update({
      payment_status: 'PAID',
    })
    .eq('id', invoiceId)

  if (invoiceUpdateError) {
    return { error: 'Gagal mengubah status invoice.' }
  }

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

  revalidatePath('/dashboard/payments')
  revalidatePath('/dashboard/orders')
  revalidatePath(`/invoice/${invoiceNumber}`)
  revalidatePath(`/track/${invoiceNumber}`)

  return { success: 'Pembayaran berhasil dikonfirmasi.' }
}
