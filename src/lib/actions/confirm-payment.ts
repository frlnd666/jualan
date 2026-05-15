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

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, payment_status, payment_proof_url')
    .eq('id', invoiceId)
    .maybeSingle()

  if (invoiceError || !invoice) {
    return { error: 'Invoice tidak ditemukan.' }
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

  if (orderUpdateError) {
    return { error: 'Invoice berhasil diubah, tapi status order gagal diperbarui.' }
  }

  revalidatePath('/dashboard/payments')
  revalidatePath('/dashboard/orders')
  revalidatePath(`/invoice/${invoiceNumber}`)
  revalidatePath(`/track/${invoiceNumber}`)

  return { success: 'Pembayaran berhasil dikonfirmasi.' }
}