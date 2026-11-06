'use server'

import { revalidatePath } from 'next/cache'
import {
  createPublicInvoiceClient,
  getInvoiceAccessToken,
  isInvoiceTokenValid,
} from '@/lib/invoice-access'

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/** Verifikasi isi file dari magic bytes — file.type dari client bisa dipalsukan. */
function matchesImageSignature(bytes: Uint8Array, mime: string) {
  if (mime === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (mime === 'image/png') {
    return (
      bytes.length >= 4 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    )
  }
  if (mime === 'image/webp') {
    const riff = bytes.length >= 4 ? String.fromCharCode(...bytes.slice(0, 4)) : ''
    const webp = bytes.length >= 12 ? String.fromCharCode(...bytes.slice(8, 12)) : ''
    return riff === 'RIFF' && webp === 'WEBP'
  }
  return false
}

export async function uploadPaymentProof(formData: FormData) {
  const invoiceId = String(formData.get('invoiceId') || '')
  const invoiceNumber = String(formData.get('invoiceNumber') || '')
  const accessToken = String(formData.get('accessToken') || '')
  const file = formData.get('file') as File | null

  if (!invoiceId || !invoiceNumber || !file) {
    return { error: 'Data upload tidak lengkap.' }
  }

  const ext = EXT_BY_MIME[file.type]
  if (!ext) {
    return { error: 'File harus JPG, PNG, atau WEBP.' }
  }

  const maxSize = 3 * 1024 * 1024
  if (file.size > maxSize) {
    return { error: 'Ukuran file maksimal 3MB.' }
  }

  const headerBytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (!matchesImageSignature(headerBytes, file.type)) {
    return { error: 'Isi file bukan gambar yang valid.' }
  }

  // Lookup lewat client publik (service_role bila sudah dikonfigurasi):
  // setelah RLS ditutup, anon tidak lagi bisa membaca/mengubah invoices.
  const supabase = await createPublicInvoiceClient()

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, invoice_number, payment_status')
    .eq('id', invoiceId)
    .maybeSingle()

  if (invoiceError || !invoice) {
    return { error: 'Invoice tidak ditemukan.' }
  }

  // Pasangan id <-> nomor invoice harus cocok persis, supaya bukti transfer
  // tidak bisa ditempelkan ke invoice orang lain.
  if (invoice.invoice_number !== invoiceNumber) {
    return { error: 'Data invoice tidak cocok.' }
  }

  const storedToken = await getInvoiceAccessToken(supabase, invoiceId)
  if (!isInvoiceTokenValid(storedToken, accessToken)) {
    return { error: 'Token akses invoice tidak valid. Buka ulang link invoice kamu.' }
  }

  if (
    invoice.payment_status !== 'PENDING_PAYMENT' &&
    invoice.payment_status !== 'WAITING_VERIFICATION'
  ) {
    return { error: 'Invoice ini sudah tidak menunggu pembayaran.' }
  }

  // Nama file acak + tanpa upsert: tidak bisa ditebak dan tidak bisa
  // menimpa bukti transfer yang sudah ada milik invoice lain.
  const filePath = `invoices/${invoiceNumber}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('payment-proofs')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
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
      // Bukti masuk = antre verifikasi seller. Status ini dipakai konsisten
      // di dashboard, halaman invoice publik, dan halaman tracking.
      payment_status: 'WAITING_VERIFICATION',
    })
    .eq('id', invoiceId)
    .eq('invoice_number', invoiceNumber)
    .in('payment_status', ['PENDING_PAYMENT', 'WAITING_VERIFICATION'])

  if (updateError) {
    // Bersihkan file yatim agar bucket tidak penuh sampah.
    await supabase.storage.from('payment-proofs').remove([filePath])
    return { error: 'Bukti transfer berhasil diupload, tetapi gagal disimpan ke invoice.' }
  }

  revalidatePath(`/invoice/${invoiceNumber}`)
  revalidatePath(`/track/${invoiceNumber}`)

  return { success: 'Bukti transfer berhasil diupload.' }
}
