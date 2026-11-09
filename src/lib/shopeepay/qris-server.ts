// Logika QRIS dinamis server-side — dipakai tiga tempat:
//   - checkout (generate otomatis setelah order QRIS dibuat),
//   - halaman invoice (generate ulang / tampil QR),
//   - route /api/qris/status (polling + inquiry cadangan).
// File ini TIDAK punya 'use server' supaya bisa diimpor route handler;
// semua fungsi menerima client Supabase (service_role bila tersedia)
// dan TIDAK PERNAH melempar — kegagalan generate = null/manual, karena
// checkout tidak boleh mati gara-gara ShopeePay.

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadDecryptedCredentials } from '@/lib/shopeepay/credentials'
import { dispatchNotify, notifyOrderEvent } from '@/lib/notify'
import { logEvent } from '@/lib/observability'
import {
  generateDynamicQr,
  ShopeePayError,
} from '@/lib/shopeepay/snap'
import {
  isQrExpired,
  partnerReferenceNoFor,
} from '@/lib/shopeepay/payload'

export interface QrisInvoice {
  id: string
  order_id: string
  invoice_number: string
  payment_status: string
  payment_method: string | null
  total: number
}

export interface QrisOrder {
  id: string
  store_id: string
}

export interface QrisPaymentRow {
  id: string
  invoice_id: string
  store_id: string
  partner_reference_no: string
  qr_content: string | null
  amount: number
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED'
  expires_at: string | null
  paid_at: string | null
  shopeepay_trx_id: string | null
}

export async function findInvoiceForQris(
  supabase: SupabaseClient,
  invoiceNumber: string
): Promise<{ invoice: QrisInvoice; order: QrisOrder } | null> {
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, order_id, invoice_number, payment_status, payment_method, total')
    .eq('invoice_number', invoiceNumber)
    .maybeSingle()
  if (error || !invoice) return null

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, store_id')
    .eq('id', (invoice as QrisInvoice).order_id)
    .maybeSingle()
  if (orderError || !order) return null

  return {
    invoice: invoice as QrisInvoice,
    order: order as QrisOrder,
  }
}

/**
 * QR aktif (PENDING, belum kedaluwarsa) untuk invoice. QR PENDING yang
 * sudah lewat masa berlaku otomatis ditandai EXPIRED supaya generate
 * ulang bisa jalan (partial unique index melarang dua PENDING).
 */
export async function getActiveQrisPayment(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<QrisPaymentRow | null> {
  const { data, error } = await supabase
    .from('qris_payments')
    .select(
      'id, invoice_id, store_id, partner_reference_no, qr_content, amount, status, expires_at, paid_at, shopeepay_trx_id'
    )
    .eq('invoice_id', invoiceId)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  const row = data as QrisPaymentRow
  if (isQrExpired(row.expires_at)) {
    // Best-effort: tandai kedaluwarsa (dan invoice ikut kedaluwarsa).
    await supabase
      .from('qris_payments')
      .update({ status: 'EXPIRED', updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'PENDING')
    // P2-07: sinkronkan juga invoices.expires_at — sebelumnya hanya
    // qris_payments yang ditandai, padahal komentar di atas mengklaim
    // invoice ikut kedaluwarsa. Guard payment_status supaya invoice
    // yang sudah dibayar tidak tersentuh.
    await supabase
      .from('invoices')
      .update({ expires_at: row.expires_at })
      .eq('id', invoiceId)
      .eq('payment_status', 'PENDING_PAYMENT')
    return null
  }
  return row
}

export interface GenerateQrResult {
  ok: boolean
  qrContent?: string
  expiresAt?: string
  partnerReferenceNo?: string
  /** Alur manual (upload bukti) tetap bisa dipakai. */
  manualFallback: boolean
  error?: string
}

/**
 * Generate QR dinamis untuk invoice QRIS yang masih PENDING_PAYMENT.
 * Mengembalikan QR yang sudah ada bila masih aktif. Gagal (toko belum
 * punya kredensial aktif / ShopeePay menolak / jaringan) = manualFallback
 * true — pemanggil menampilkan alur manual lama, BUKAN error fatal.
 */
export async function createDynamicQrPayment(
  supabase: SupabaseClient,
  invoice: QrisInvoice,
  order: QrisOrder
): Promise<GenerateQrResult> {
  if (invoice.payment_method !== 'QRIS') {
    return { ok: false, manualFallback: true, error: 'Invoice ini bukan QRIS.' }
  }
  if (invoice.payment_status !== 'PENDING_PAYMENT') {
    return { ok: false, manualFallback: false, error: 'Invoice sudah tidak menunggu pembayaran.' }
  }

  const existing = await getActiveQrisPayment(supabase, invoice.id)
  if (existing && existing.qr_content) {
    return {
      ok: true,
      qrContent: existing.qr_content,
      expiresAt: existing.expires_at ?? undefined,
      partnerReferenceNo: existing.partner_reference_no,
      manualFallback: false,
    }
  }

  const creds = await loadDecryptedCredentials(supabase, order.store_id)
  if (!creds || !creds.isActive) {
    return {
      ok: false,
      manualFallback: true,
      error: 'Toko belum mengaktifkan QRIS dinamis ShopeePay.',
    }
  }

  // Nomor referensi baru untuk setiap percobaan generate (aturan ShopeePay).
  const { count } = await supabase
    .from('qris_payments')
    .select('id', { count: 'exact', head: true })
    .eq('invoice_id', invoice.id)
  const attempt = (count ?? 0) + 1
  const partnerReferenceNo = partnerReferenceNoFor(invoice.invoice_number, attempt)

  let generated
  try {
    generated = await generateDynamicQr({
      ...creds,
      storeId: order.store_id,
      partnerReferenceNo,
      amount: Number(invoice.total),
    })
  } catch (error) {
    const message =
      error instanceof ShopeePayError
        ? error.message
        : 'Gagal membuat QR dinamis.'
    // Kegagalan generate dicatat di log server; pembeli tetap bisa
    // bayar manual (penjual memberi QR, bukti diupload).
    console.error('[qris] generate gagal', invoice.invoice_number, message)
    return { ok: false, manualFallback: true, error: message }
  }

  const expiresAt = generated.expiresAt.toISOString()
  const { error: insertError } = await supabase.from('qris_payments').insert({
    invoice_id: invoice.id,
    store_id: order.store_id,
    partner_reference_no: partnerReferenceNo,
    qr_content: generated.qrContent,
    amount: Number(invoice.total),
    status: 'PENDING',
    expires_at: expiresAt,
    shopeepay_trx_id: generated.trxId,
  })
  if (insertError) {
    // Balapan generate ganda: QR lain sudah tersimpan — pakai yang itu.
    const raced = await getActiveQrisPayment(supabase, invoice.id)
    if (raced?.qr_content) {
      return {
        ok: true,
        qrContent: raced.qr_content,
        expiresAt: raced.expires_at ?? undefined,
        partnerReferenceNo: raced.partner_reference_no,
        manualFallback: false,
      }
    }
    console.error('[qris] simpan QR gagal', invoice.invoice_number, insertError.message)
    return { ok: false, manualFallback: true, error: 'Gagal menyimpan QR dinamis.' }
  }

  // Invoice ikut kedaluwarsa bersama QR-nya.
  await supabase
    .from('invoices')
    .update({ expires_at: expiresAt })
    .eq('id', invoice.id)

  return {
    ok: true,
    qrContent: generated.qrContent,
    expiresAt,
    partnerReferenceNo,
    manualFallback: false,
  }
}

/**
 * Dipakai checkout: coba buatkan QR dinamis setelah order QRIS dibuat.
 * TIDAK PERNAH melempar — gagal = null, checkout lanjut ke alur manual.
 */
export async function tryGenerateDynamicQrForInvoice(
  supabase: SupabaseClient,
  invoiceNumber: string
): Promise<{ qrContent: string; expiresAt: string } | null> {
  try {
    const found = await findInvoiceForQris(supabase, invoiceNumber)
    if (!found) return null
    const result = await createDynamicQrPayment(supabase, found.invoice, found.order)
    if (!result.ok || !result.qrContent || !result.expiresAt) return null
    return { qrContent: result.qrContent, expiresAt: result.expiresAt }
  } catch {
    return null
  }
}

export interface ApplyQrisPaidResult {
  applied: boolean
  alreadyPaid: boolean
}

/**
 * Terapkan status lunas dari QRIS (webhook / inquiry). IDEMPOTENT:
 * bila qris_payments sudah PAID, tidak ada efek ganda (stok tidak
 * diutak-atik di sini — stok sudah dikurangi saat checkout; yang diubah
 * hanya status invoice + order + notifikasi).
 * Transisi hanya maju: invoice/order yang sudah PAID/PROCESSING tidak
 * pernah dimundurkan.
 */
export async function applyQrisPaid(
  supabase: SupabaseClient,
  qrisRow: QrisPaymentRow,
  shopeepayTrxId: string | null
): Promise<ApplyQrisPaidResult> {
  // Kunci idempotensi: hanya baris PENDING yang boleh berubah.
  const { data: updated } = await supabase
    .from('qris_payments')
    .update({
      status: 'PAID',
      paid_at: new Date().toISOString(),
      shopeepay_trx_id: shopeepayTrxId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', qrisRow.id)
    .eq('status', 'PENDING')
    .select('id')
  if (!updated?.length) {
    // Sudah PAID (webhook ganda) atau EXPIRED/FAILED.
    return { applied: false, alreadyPaid: qrisRow.status === 'PAID' }
  }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, invoice_number, payment_status, order_id')
    .eq('id', qrisRow.invoice_id)
    .maybeSingle()
  if (invoice) {
    const inv = invoice as {
      id: string
      invoice_number: string
      payment_status: string
      order_id: string
    }
    if (inv.payment_status !== 'PAID') {
      await supabase
        .from('invoices')
        .update({
          payment_status: 'PAID',
          payment_verified_at: new Date().toISOString(),
        })
        .eq('id', inv.id)
        .in('payment_status', ['PENDING_PAYMENT', 'WAITING_VERIFICATION'])
    }

    const { data: order } = await supabase
      .from('orders')
      .select('id, store_id, status, customer_name, customer_phone, total, buyer_id')
      .eq('id', inv.order_id)
      .maybeSingle()
    if (order) {
      const ord = order as {
        id: string
        store_id: string
        status: string
        customer_name: string
        customer_phone: string | null
        total: number
        buyer_id: string | null
      }
      if (ord.status === 'PENDING_PAYMENT') {
        await supabase
          .from('orders')
          .update({ status: 'PROCESSING' })
          .eq('id', ord.id)
          .eq('status', 'PENDING_PAYMENT')
      }

      // Notifikasi best-effort (webhook tidak boleh gagal karenanya):
      // in-app + email + WhatsApp ke pemilik toko + pembeli.
      try {
        const { data: store } = await supabase
          .from('stores')
          .select('owner_id, name')
          .eq('id', ord.store_id)
          .maybeSingle()
        const storeRow = store as { owner_id: string; name: string } | null
        if (storeRow && ord.status === 'CANCELLED') {
          // Audit 2026-11-09: balapan webhook vs pembatalan seller —
          // uang BENAR-BENAR masuk (baris qris_payments di atas sah
          // berstatus PAID) tapi order sudah batal dan stok sudah
          // kembali. Jangan kirim notifikasi "lunas" normal: catat
          // anomali + peringatkan seller SAJA untuk refund manual.
          logEvent('qris_paid_for_cancelled_order', {
            orderId: ord.id,
            invoiceNumber: inv.invoice_number,
            amount: Number(ord.total),
          })
          void dispatchNotify(supabase, {
            userId: storeRow.owner_id,
            storeId: ord.store_id,
            orderId: ord.id,
            type: 'QRIS_PAID',
            title: 'Pembayaran QRIS masuk untuk pesanan yang sudah dibatalkan',
            body: `Pesanan ${inv.invoice_number} sudah dibatalkan, tetapi pembayaran QRIS-nya baru masuk. Hubungi pembeli untuk proses refund.`,
            link: `/dashboard/orders/${ord.id}`,
            data: {
              storeName: storeRow.name,
              orderNumber: inv.invoice_number,
              customerName: ord.customer_name,
              total: Number(ord.total),
              link: `/dashboard/orders/${ord.id}`,
            },
            recipient: 'seller',
          })
        } else if (storeRow) {
          void notifyOrderEvent(
            supabase,
            {
              ownerId: storeRow.owner_id,
              buyerId: ord.buyer_id,
              storeId: ord.store_id,
              orderId: ord.id,
              invoiceNumber: inv.invoice_number,
              customerName: ord.customer_name,
              total: Number(ord.total),
            },
            'QRIS_PAID',
            storeRow.name,
            { buyerPhone: ord.customer_phone }
          )
        }
      } catch {}
    }
  }

  return { applied: true, alreadyPaid: false }
}
