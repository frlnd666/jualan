'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function uploadPaymentProof(formData: FormData) {
  const invoiceId = String(formData.get('invoiceId') || '')
  const invoiceNumber = String(formData.get('invoiceNumber') || '')
  const file = formData.get('file') as File | null

  if (!invoiceId || !invoiceNumber || !file) {
    return { error: 'Data upload tidak lengkap.' }
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'File harus JPG, PNG, atau WEBP.' }
  }

  const maxSize = 3 * 1024 * 1024
  if (file.size > maxSize) {
    return { error: 'Ukuran file maksimal 3MB.' }
  }

  const supabase = await createClient()

  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const filePath = `invoices/${invoiceNumber}/${Date.now()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('payment-proofs')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    return { error: 'Upload file gagal.' }
  }

  const { data: publicUrlData } = supabase.storage
    .from('payment-proofs')
    .getPublicUrl(filePath)

  const publicUrl = publicUrlData.publicUrl

  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      payment_proof_url: publicUrl,
    })
    .eq('id', invoiceId)

  if (updateError) {
    return { error: 'Bukti transfer berhasil diupload, tetapi gagal disimpan ke invoice.' }
  }

  revalidatePath(`/invoice/${invoiceNumber}`)
  revalidatePath(`/track/${invoiceNumber}`)

  return { success: 'Bukti transfer berhasil diupload.' }
}