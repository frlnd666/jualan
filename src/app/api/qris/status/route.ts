// Status QRIS untuk polling halaman invoice — GET /api/qris/status.
// Query: ?invoice=INV-...&t=<access_token invoice>.
//
// Alur:
//   1. Verifikasi token invoice (sama seperti halaman invoice).
//   2. Baca status lokal dulu (qris_payments): PAID / PENDING / EXPIRED.
//   3. Bila masih PENDING dan belum kedaluwarsa, coba inquiry ke
//      ShopeePay sebagai cadangan bila webhook telat/hilang — bila
//      inquiry menyatakan lunas, terapkan transisi yang sama dengan
//      webhook (applyQrisPaid, idempotent).
//   4. Kegagalan inquiry TIDAK PERNAH error — status lokal yang dipakai.
//
// Route ini dynamic dan tidak mengembalikan secret/kredensial.

import { NextResponse } from 'next/server'
import { createPublicInvoiceClient, getInvoiceAccessToken, isInvoiceTokenValid } from '@/lib/invoice-access'
import {
  applyQrisPaid,
  findInvoiceForQris,
  getActiveQrisPayment,
} from '@/lib/shopeepay/qris-server'
import { loadDecryptedCredentials } from '@/lib/shopeepay/credentials'
import { queryQrStatus } from '@/lib/shopeepay/snap'
import { isQrExpired } from '@/lib/shopeepay/payload'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const invoiceNumber = url.searchParams.get('invoice') ?? ''
  const token = url.searchParams.get('t') ?? null

  if (!invoiceNumber) {
    return NextResponse.json({ error: 'Invoice tidak ditemukan.' }, { status: 404 })
  }

  const supabase = await createPublicInvoiceClient()
  const found = await findInvoiceForQris(supabase, invoiceNumber)
  if (!found) {
    return NextResponse.json({ error: 'Invoice tidak ditemukan.' }, { status: 404 })
  }

  const storedToken = await getInvoiceAccessToken(supabase, found.invoice.id)
  if (!isInvoiceTokenValid(storedToken, token)) {
    return NextResponse.json({ error: 'Link invoice tidak valid.' }, { status: 404 })
  }

  // Status lokal dulu.
  const { data: latest } = await supabase
    .from('qris_payments')
    .select('status, expires_at, paid_at')
    .eq('invoice_id', found.invoice.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const latestRow = latest as {
    status: string
    expires_at: string | null
    paid_at: string | null
  } | null

  if (!latestRow) {
    return NextResponse.json({ status: 'NO_QR', paymentStatus: found.invoice.payment_status })
  }
  if (latestRow.status === 'PAID') {
    return NextResponse.json({ status: 'PAID', paymentStatus: 'PAID' })
  }

  const active = await getActiveQrisPayment(supabase, found.invoice.id)
  if (!active) {
    // Tidak ada QR aktif: entah kedaluwarsa (baru ditandai) atau FAILED.
    const status = latestRow.status === 'EXPIRED' || isQrExpired(latestRow.expires_at)
      ? 'EXPIRED'
      : latestRow.status
    return NextResponse.json({ status, paymentStatus: found.invoice.payment_status })
  }

  // Masih PENDING & belum kedaluwarsa — coba inquiry sebagai cadangan
  // webhook. Gagal = tetap kembalikan status lokal.
  const creds = await loadDecryptedCredentials(supabase, found.order.store_id)
  if (creds?.isActive) {
    const inquiry = await queryQrStatus(creds, active.partner_reference_no)
    if (inquiry === 'PAID') {
      await applyQrisPaid(supabase, active, null)
      return NextResponse.json({ status: 'PAID', paymentStatus: 'PAID' })
    }
  }

  return NextResponse.json({
    status: 'PENDING',
    paymentStatus: found.invoice.payment_status,
    expiresAt: active.expires_at,
  })
}
