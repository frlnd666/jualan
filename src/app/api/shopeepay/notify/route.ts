// Webhook notifikasi pembayaran ShopeePay (SNAP) — POST /api/shopeepay/notify.
// Route ini adalah SUMBER KEBENARAN status lunas QRIS dinamis.
//
// Keamanan:
//   - Signature HMAC-SHA512 (header X-SIGNATURE) diverifikasi pada SETIAP
//     notifikasi memakai clientSecret toko (didekripsi server-side).
//     StringToSign SNAP: method:relativeUrl:accessToken:sha256(body):timestamp.
//     Untuk notifikasi, accessToken kosong (pengirim tidak punya token);
//     bila header Authorization Bearer ada, dicoba juga sebagai komponen.
//   - partnerReferenceNo + nominal dicocokkan ke qris_payments; nominal
//     tidak cocok = ditolak.
//   - Idempotent: applyQrisPaid hanya mengubah baris PENDING — webhook
//     yang sama dikirim dua kali tidak menggandakan efek.
//   - Route ini dynamic (tidak di-cache) dan tidak mengembalikan secret.
//
// CATATAN PILOT: skema signature notifikasi ShopeePay WAJIB dikonfirmasi
// ke dokumen Partner saat kredensial sandbox tiba — bila sandbox memakai
// varian stringToSign lain, sesuaikan verify di sini (dan tes ulang
// checklist sandbox butir 3–4). Bila verifikasi gagal, route mengembalikan
// 401 dan status bisa dipulihkan lewat inquiry di /api/qris/status.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPublicInvoiceClient } from '@/lib/invoice-access'
import { decryptSecret, sha256Hex, verifyWebhookSignature } from '@/lib/shopeepay/crypto'
import { logEvent } from '@/lib/observability'
import {
  applyQrisPaid,
  type QrisPaymentRow,
} from '@/lib/shopeepay/qris-server'

export const dynamic = 'force-dynamic'

const RELATIVE_URL = '/api/shopeepay/notify'

function snapSuccess(message = 'Successful') {
  return NextResponse.json({ responseCode: '2004700', responseMessage: message })
}

function snapError(code: string, message: string, httpStatus: number) {
  return NextResponse.json(
    { responseCode: code, responseMessage: message },
    { status: httpStatus }
  )
}

interface NotifyBody {
  partnerReferenceNo?: string
  originalPartnerReferenceNo?: string
  merchantId?: string
  amount?: { value?: string | number; currency?: string }
  transactionStatus?: string
  status?: string
  trxId?: string
  transactionId?: string
}

function isPaidStatus(value: string | undefined): boolean {
  const v = (value ?? '').toUpperCase()
  return v === 'PAID' || v === 'SUCCESS' || v === '00' || v === 'COMPLETED'
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  let body: NotifyBody
  try {
    body = JSON.parse(rawBody) as NotifyBody
  } catch {
    return snapError('4004700', 'Invalid JSON body', 400)
  }

  const partnerReferenceNo =
    body.partnerReferenceNo || body.originalPartnerReferenceNo || ''
  const merchantId = body.merchantId || ''
  if (!partnerReferenceNo) {
    return snapError('4004701', 'partnerReferenceNo kosong', 400)
  }

  // Fase 4 (observability) — setiap webhook tercatat, apa pun hasilnya.
  logEvent('qris_webhook_received', { partnerReferenceNo })

  const supabase = await createPublicInvoiceClient()
  const admin = createAdminClient()
  const db = admin ?? supabase

  // Cari baris QR dari referensi — ini juga yang menentukan toko (dan
  // karena itu clientSecret) untuk verifikasi signature.
  const { data: qris, error: qrisError } = await db
    .from('qris_payments')
    .select(
      'id, invoice_id, store_id, partner_reference_no, qr_content, amount, status, expires_at, paid_at, shopeepay_trx_id'
    )
    .eq('partner_reference_no', partnerReferenceNo)
    .maybeSingle()

  if (qrisError || !qris) {
    return snapError('4044701', 'Transaksi tidak ditemukan', 404)
  }
  const qrisRow = qris as QrisPaymentRow

  // Sudah lunas sebelumnya (webhook ganda) — sukses tanpa efek.
  if (qrisRow.status === 'PAID') {
    return snapSuccess('Already paid')
  }
  if (qrisRow.status !== 'PENDING') {
    return snapError('4004702', `Transaksi sudah ${qrisRow.status}`, 400)
  }

  // Muat kredensial toko untuk verifikasi signature.
  const { data: creds } = await db
    .from('store_shopeepay_credentials')
    .select('client_id, client_secret_enc, merchant_id')
    .eq('store_id', qrisRow.store_id)
    .maybeSingle()

  if (!creds) {
    return snapError('4044702', 'Kredensial toko tidak ditemukan', 404)
  }
  const credRow = creds as {
    client_id: string
    client_secret_enc: string
    merchant_id: string
  }
  // merchantId dari notifikasi (bila ada) harus cocok dengan toko.
  if (merchantId && merchantId !== credRow.merchant_id) {
    return snapError('4014701', 'Merchant tidak cocok', 401)
  }

  let clientSecret: string
  try {
    clientSecret = decryptSecret(credRow.client_secret_enc)
  } catch {
    return snapError('5004700', 'Kredensial toko tidak bisa dibaca', 500)
  }

  const signature = request.headers.get('x-signature') ?? ''
  const timestamp = request.headers.get('x-timestamp') ?? ''
  const bearer = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const bodyHash = sha256Hex(rawBody)

  const candidates = ['', bearer].filter((v, i, arr) => arr.indexOf(v) === i)
  const verified = candidates.some((accessToken) =>
    verifyWebhookSignature(
      clientSecret,
      ['POST', RELATIVE_URL, accessToken, bodyHash, timestamp].join(':'),
      signature
    )
  )
  if (!verified) {
    // Fase 4 (observability) — jejak terstruktur penolakan webhook.
    logEvent('qris_webhook_rejected', {
      partnerReferenceNo,
      reason: 'signature_invalid',
    })
    return snapError('4014700', 'Signature tidak valid', 401)
  }

  // Status notifikasi harus lunas; status lain (gagal/pending) tidak
  // mengubah apa pun — pemanggil bisa inquiry lewat route status.
  const statusValue = body.transactionStatus ?? body.status
  if (!isPaidStatus(statusValue)) {
    return snapSuccess('Status bukan lunas — diabaikan')
  }

  // Nominal WAJIB ada dan harus cocok dengan yang ditagih (toleransi
  // 1 rupiah untuk pembulatan format desimal). Notifikasi bertanda tangan
  // tanpa nominal tidak boleh melunasi apa pun (audit 2026-11-09).
  const notifiedAmount = Number(body.amount?.value ?? NaN)
  if (
    !Number.isFinite(notifiedAmount) ||
    Math.abs(notifiedAmount - Number(qrisRow.amount)) > 1
  ) {
    logEvent('qris_webhook_rejected', {
      partnerReferenceNo,
      reason: 'amount_mismatch',
    })
    return snapError('4004703', 'Nominal tidak cocok', 400)
  }

  const trxId = body.trxId ?? body.transactionId ?? null
  const result = await applyQrisPaid(db, qrisRow, trxId)
  if (!result.applied && !result.alreadyPaid) {
    return snapError('4004704', 'Transaksi tidak bisa ditandai lunas', 400)
  }
  // Fase 4 (observability) — webhook lunas diterima (idempotent: webhook
  // ganda tercatat sebagai alreadyPaid, bukan paid baru).
  logEvent('qris_webhook_paid', {
    partnerReferenceNo,
    storeId: qrisRow.store_id,
    amount: Number(qrisRow.amount),
    alreadyPaid: result.alreadyPaid === true,
  })
  return snapSuccess()
}
