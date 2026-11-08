// Server action QRIS dinamis untuk halaman invoice (publik).
// Akses digerakkan token invoice (?t=...) — SAMA seperti halaman
// invoice-nya: tanpa token yang cocok, tidak ada QR yang dibocorkan.
// Generate memakai kredensial toko (server-side); browser hanya menerima
// qrContent + masa berlaku.

'use server'

import {
  createPublicInvoiceClient,
  getInvoiceAccessToken,
  isInvoiceTokenValid,
} from '@/lib/invoice-access'
import {
  createDynamicQrPayment,
  findInvoiceForQris,
  getActiveQrisPayment,
  type QrisPaymentRow,
} from '@/lib/shopeepay/qris-server'

export interface QrisPaymentView {
  status: QrisPaymentRow['status']
  qrContent: string | null
  expiresAt: string | null
  amount: number
  partnerReferenceNo: string
}

/**
 * QR aktif untuk invoice (bila ada). Dipakai halaman invoice untuk
 * menampilkan QR + hitung mundur tanpa generate ulang tiap buka halaman.
 */
export async function getQrisPaymentForInvoiceAction(
  invoiceNumber: string,
  token: string | null
): Promise<QrisPaymentView | null> {
  const supabase = await createPublicInvoiceClient()
  const found = await findInvoiceForQris(supabase, invoiceNumber)
  if (!found) return null

  const storedToken = await getInvoiceAccessToken(supabase, found.invoice.id)
  if (!isInvoiceTokenValid(storedToken, token)) return null

  const row = await getActiveQrisPayment(supabase, found.invoice.id)
  if (!row) return null
  return {
    status: row.status,
    qrContent: row.qr_content,
    expiresAt: row.expires_at,
    amount: Number(row.amount),
    partnerReferenceNo: row.partner_reference_no,
  }
}

export interface GenerateQrActionResult {
  ok: boolean
  qrContent?: string
  expiresAt?: string
  /** true = tampilkan alur manual (upload bukti) sebagai gantinya. */
  manualFallback: boolean
  error?: string
}

/**
 * Buat (atau pakai ulang) QR dinamis untuk invoice. Dipanggil halaman
 * invoice saat pembeli membuka pembayaran QRIS, dan tombol "Buat QR baru"
 * saat QR lama kedaluwarsa.
 */
export async function generateDynamicQrAction(
  invoiceNumber: string,
  token: string | null
): Promise<GenerateQrActionResult> {
  const supabase = await createPublicInvoiceClient()
  const found = await findInvoiceForQris(supabase, invoiceNumber)
  if (!found) {
    return { ok: false, manualFallback: true, error: 'Invoice tidak ditemukan.' }
  }

  const storedToken = await getInvoiceAccessToken(supabase, found.invoice.id)
  if (!isInvoiceTokenValid(storedToken, token)) {
    return { ok: false, manualFallback: true, error: 'Link invoice tidak valid.' }
  }

  const result = await createDynamicQrPayment(supabase, found.invoice, found.order)
  return {
    ok: result.ok,
    qrContent: result.qrContent,
    expiresAt: result.expiresAt,
    manualFallback: result.manualFallback,
    error: result.error,
  }
}
