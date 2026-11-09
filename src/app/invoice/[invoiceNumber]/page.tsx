import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  createPublicInvoiceClient,
  getInvoiceAccessToken,
  isInvoiceTokenValid,
  tokenQuery,
} from '@/lib/invoice-access'
import {
  maskCustomerName,
  maskPhoneNumber,
  publicAddressLine,
} from '@/lib/utils/privacy'
import {
  buildOrderTimeline,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
  getShipmentStatusLabel,
} from '@/lib/order-status'
import UploadPaymentProofForm from '@/components/invoice/UploadPaymentProofForm'
import DynamicQrisPanel from '@/components/invoice/DynamicQrisPanel'
import { getQrisPaymentForInvoiceAction } from '@/lib/actions/qris'
import PublicConfigNotice from '@/components/PublicConfigNotice'
import OrderTimeline from '@/components/order/OrderTimeline'
import InvoiceShareButtons from '@/components/order/InvoiceShareButtons'
import CopyTextButton from '@/components/order/CopyTextButton'
import { isAdminClientConfigured } from '@/lib/supabase/admin'

type InvoicePageProps = {
  params: Promise<{
    invoiceNumber: string
  }>
  searchParams: Promise<{
    t?: string
    baru?: string
  }>
}

function paymentBadgeClass(status: string): string {
  switch (status) {
    case 'PAID':
      return 'bg-emerald-100 text-emerald-800'
    case 'WAITING_VERIFICATION':
      return 'bg-sky-100 text-sky-800'
    case 'FAILED':
      return 'bg-red-100 text-red-700'
    case 'REFUNDED':
      return 'bg-neutral-200 text-neutral-700'
    default:
      return 'bg-amber-100 text-amber-800'
  }
}

function orderBadgeClass(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-emerald-100 text-emerald-800'
    case 'CANCELLED':
      return 'bg-red-100 text-red-700'
    case 'SHIPPED':
      return 'bg-sky-100 text-sky-800'
    default:
      return 'bg-neutral-200 text-neutral-700'
  }
}

function formatRupiah(value: number | string): string {
  return `Rp ${Number(value).toLocaleString('id-ID')}`
}

export default async function InvoicePage({ params, searchParams }: InvoicePageProps) {
  const { invoiceNumber } = await params
  const { t, baru } = await searchParams
  const supabase = await createPublicInvoiceClient()

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select(`
      id,
      order_id,
      invoice_number,
      payment_status,
      payment_proof_url,
      total,
      payment_method,
      created_at
    `)
    .eq('invoice_number', invoiceNumber)
    .maybeSingle()

  if (invoiceError || !invoice) {
    // Bedakan "invoice memang tidak ada" dari "server belum bisa membaca
    // invoice karena kunci service-role belum terpasang" — yang kedua
    // jangan menyamar sebagai 404.
    if (!isAdminClientConfigured()) {
      return <PublicConfigNotice />
    }
    notFound()
  }

  // Gerbang token: nomor invoice saja tidak cukup membuka halaman ini.
  const storedToken = await getInvoiceAccessToken(supabase, invoice.id)
  if (!isInvoiceTokenValid(storedToken, t)) {
    notFound()
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id,
      store_id,
      customer_name,
      customer_phone,
      address,
      province,
      city,
      postal_code,
      notes,
      subtotal,
      shipping_cost,
      total,
      status,
      payment_method,
      shipping_method_name,
      discount_amount,
      voucher_code,
      total_weight_gram,
      created_at
    `)
    .eq('id', invoice.order_id)
    .maybeSingle()

  if (orderError || !order) {
    notFound()
  }

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select(`
      id,
      name,
      slug,
      whatsapp
    `)
    .eq('id', order.store_id)
    .maybeSingle()

  if (storeError || !store) {
    notFound()
  }

  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select(`
      id,
      order_id,
      product_id,
      product_name,
      qty,
      price,
      subtotal,
      notes
    `)
    .eq('order_id', order.id)
    .order('id', { ascending: true })

  if (itemsError) {
    notFound()
  }

  // Info pengiriman kini tinggal di halaman yang sama (dulu halaman /track
  // terpisah dengan isi yang nyaris sama).
  const { data: shipment } = await supabase
    .from('shipments')
    .select(`
      id,
      courier,
      tracking_number,
      status
    `)
    .eq('order_id', order.id)
    .maybeSingle()

  const isNewOrder = baru === '1'
  const isCancelled = order.status === 'CANCELLED'
  const isCod = invoice.payment_method === 'COD'
  const timeline = buildOrderTimeline(order.status, invoice.payment_status)
  const invoicePath = `/invoice/${invoice.invoice_number}${tokenQuery(storedToken)}`

  // Fase 3 — QRIS dinamis: bila invoice QRIS masih menunggu bayar, muat
  // QR aktif (bila ada) untuk panel QR. Panel-nya sendiri yang akan
  // generate QR bila belum ada; bila toko belum mengaktifkan QRIS
  // dinamis, panel tidak tampil dan alur manual lama yang jalan.
  const showDynamicQris =
    invoice.payment_method === 'QRIS' && invoice.payment_status === 'PENDING_PAYMENT'
  const existingQris = showDynamicQris
    ? await getQrisPaymentForInvoiceAction(invoice.invoice_number, t ?? null)
    : null

  return (
    <div className="min-h-screen bg-neutral-50 px-4 pb-28 pt-6 md:px-6 md:pb-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {isNewOrder && !isCancelled ? (
          <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-sm md:p-8">
            <p className="text-3xl" aria-hidden>
              ✓
            </p>
            <h1 className="mt-2 text-2xl font-bold">Pesanan berhasil dibuat!</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-50">
              Satu langkah lagi: selesaikan pembayaranmu mengikuti 3 langkah di
              halaman ini. Simpan link halaman ini — kirim ke WhatsApp-mu
              sendiri supaya tidak hilang. Link ini adalah kunci pesananmu:
              semua status dan info pengiriman tampil di sini.
            </p>
            <div className="mt-5">
              <InvoiceShareButtons
                invoicePath={invoicePath}
                invoiceNumber={invoice.invoice_number}
                storeName={store.name}
                storeWhatsapp={store.whatsapp}
              />
            </div>
          </div>
        ) : null}

        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">
                Invoice dari {store.name}
              </p>
              <h1 className="mt-1 break-all text-2xl font-bold text-neutral-900">
                {invoice.invoice_number}
              </h1>
              <p className="mt-2 text-sm text-neutral-600">
                {new Date(invoice.created_at).toLocaleString('id-ID', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 md:justify-end">
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${paymentBadgeClass(invoice.payment_status)}`}
              >
                Pembayaran: {getPaymentStatusLabel(invoice.payment_status)}
              </span>
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${orderBadgeClass(order.status)}`}
              >
                Pesanan: {getOrderStatusLabel(order.status)}
              </span>
            </div>
          </div>
        </div>

        {isCancelled ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 md:p-6">
            <h2 className="text-lg font-bold text-red-800">Pesanan dibatalkan</h2>
            <p className="mt-2 text-sm leading-6 text-red-700">
              Pesanan ini sudah dibatalkan. Jika kamu merasa ini keliru atau
              sudah terlanjur membayar, hubungi penjual lewat tombol Chat
              penjual di bawah.
            </p>
          </div>
        ) : (
          <>
            <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-bold text-neutral-900">Status pesanan</h2>
              <div className="mt-5">
                <OrderTimeline steps={timeline} />
              </div>
            </section>

            {showDynamicQris ? (
              <DynamicQrisPanel
                invoiceNumber={invoice.invoice_number}
                token={t ?? null}
                initialQrContent={existingQris?.qrContent ?? null}
                initialExpiresAt={existingQris?.expiresAt ?? null}
                amount={Number(invoice.total)}
              />
            ) : null}

            {invoice.payment_status === 'PENDING_PAYMENT' && !isCod ? (
              <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 md:p-6">
                <h2 className="text-lg font-bold text-amber-900">
                  Selesaikan pesananmu — 3 langkah
                </h2>

                <ol className="mt-5 space-y-6">
                  <li className="flex gap-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                      1
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-amber-900">
                        Bayar {formatRupiah(invoice.total)} via{' '}
                        {getPaymentMethodLabel(invoice.payment_method)}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-amber-800">
                        Gunakan detail tujuan (nomor rekening / kode QR) yang
                        diberikan penjual — tanyakan lewat tombol Chat penjual
                        bila belum menerimanya. Bayar persis sampai digit
                        terakhir agar mudah diverifikasi.
                      </p>
                    </div>
                  </li>

                  <li className="flex gap-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                      2
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-amber-900">
                        Upload bukti pembayaran
                      </p>
                      <p className="mt-1 text-sm leading-6 text-amber-800">
                        Foto atau tangkapan layar bukti transfer, maksimal 3 MB.
                      </p>
                      <div className="mt-3">
                        <UploadPaymentProofForm
                          invoiceId={invoice.id}
                          invoiceNumber={invoice.invoice_number}
                          paymentProofUrl={invoice.payment_proof_url}
                          accessToken={storedToken || ''}
                        />
                      </div>
                    </div>
                  </li>

                  <li className="flex gap-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                      3
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-amber-900">
                        Tunggu verifikasi penjual
                      </p>
                      <p className="mt-1 text-sm leading-6 text-amber-800">
                        Setelah bukti terkirim, status di halaman ini berubah
                        menjadi “Menunggu verifikasi”, lalu “Sudah dibayar”
                        begitu penjual mengonfirmasi. Pesananmu kemudian
                        diproses dan dikirim — nomor resinya tampil di sini.
                      </p>
                    </div>
                  </li>
                </ol>
              </section>
            ) : null}

            {invoice.payment_status === 'PENDING_PAYMENT' && isCod ? (
              <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 md:p-6">
                <h2 className="text-lg font-bold text-amber-900">
                  Pembayaran COD (bayar di tempat)
                </h2>
                <p className="mt-2 text-sm leading-6 text-amber-800">
                  Kamu memilih bayar di tempat: siapkan{' '}
                  <strong>{formatRupiah(invoice.total)}</strong> untuk dibayar
                  ke kurir saat barang tiba. Tidak perlu upload bukti
                  pembayaran.
                </p>
              </section>
            ) : null}

            {invoice.payment_status === 'WAITING_VERIFICATION' ? (
              <section className="rounded-3xl border border-sky-200 bg-sky-50 p-5 md:p-6">
                <h2 className="text-lg font-bold text-sky-900">
                  Bukti pembayaran terkirim ✓
                </h2>
                <p className="mt-2 text-sm leading-6 text-sky-800">
                  Penjual sedang memeriksa bukti pembayaranmu. Status di
                  halaman ini akan berubah menjadi “Sudah dibayar” setelah
                  terverifikasi, lalu pesananmu diproses dan dikirim.
                </p>
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-sky-900">
                    Salah upload? Ganti bukti transfer
                  </summary>
                  <div className="mt-3">
                    <UploadPaymentProofForm
                      invoiceId={invoice.id}
                      invoiceNumber={invoice.invoice_number}
                      paymentProofUrl={invoice.payment_proof_url}
                      accessToken={storedToken || ''}
                    />
                  </div>
                </details>
              </section>
            ) : null}

            {invoice.payment_status === 'PAID' ? (
              <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 md:p-6">
                <h2 className="text-lg font-bold text-emerald-900">
                  Pembayaran terkonfirmasi ✓
                </h2>
                <p className="mt-2 text-sm leading-6 text-emerald-800">
                  Terima kasih! Pembayaranmu sudah diterima. Pantau status
                  pesanan dan nomor resi di halaman ini.
                </p>
              </section>
            ) : null}

            {invoice.payment_status === 'FAILED' ? (
              <section className="rounded-3xl border border-red-200 bg-red-50 p-5 md:p-6">
                <h2 className="text-lg font-bold text-red-800">
                  Pembayaran dinyatakan gagal
                </h2>
                <p className="mt-2 text-sm leading-6 text-red-700">
                  Hubungi penjual lewat tombol Chat penjual untuk
                  menyelesaikannya.
                </p>
              </section>
            ) : null}

            {invoice.payment_status === 'REFUNDED' ? (
              <section className="rounded-3xl border border-neutral-200 bg-white p-5 md:p-6">
                <h2 className="text-lg font-bold text-neutral-900">
                  Dana sudah dikembalikan
                </h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  Pembayaran untuk invoice ini telah di-refund oleh penjual.
                </p>
              </section>
            ) : null}
          </>
        )}

        {shipment ? (
          <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-bold text-neutral-900">Info pengiriman</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Kurir
                </p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">
                  {shipment.courier || order.shipping_method_name || '-'}
                </p>
              </div>
              <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Status pengiriman
                </p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">
                  {getShipmentStatusLabel(shipment.status)}
                </p>
              </div>
              <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Nomor resi
                </p>
                {shipment.tracking_number ? (
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-neutral-900">
                    <span className="break-all font-mono">
                      {shipment.tracking_number}
                    </span>
                    <CopyTextButton text={shipment.tracking_number} />
                  </p>
                ) : (
                  <p className="mt-1 text-sm font-semibold text-neutral-900">-</p>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-bold text-neutral-900">Item pesanan</h2>

              <div className="mt-4 space-y-3">
                {(orderItems || []).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-4 rounded-2xl bg-neutral-50 px-4 py-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-900">
                        {item.product_name}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {item.qty} x {formatRupiah(item.price)}
                      </p>
                      {item.notes ? (
                        <p className="mt-2 text-xs text-neutral-500">
                          Catatan: {item.notes}
                        </p>
                      ) : null}
                    </div>

                    <p className="shrink-0 text-sm font-semibold text-neutral-900">
                      {formatRupiah(item.subtotal)}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-bold text-neutral-900">Data penerima</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Nama
                  </p>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">
                    {maskCustomerName(order.customer_name)}
                  </p>
                </div>

                <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    WhatsApp
                  </p>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">
                    {maskPhoneNumber(order.customer_phone)}
                  </p>
                </div>

                <div className="rounded-2xl bg-neutral-50 px-4 py-3 md:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Alamat tujuan
                  </p>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">
                    {publicAddressLine(order)}
                  </p>
                  <p className="mt-2 text-sm text-neutral-600">
                    Alamat lengkap hanya tampil di dashboard penjual demi
                    keamanan data customer.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-bold text-neutral-900">Ringkasan pembayaran</h2>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between text-neutral-600">
                  <span>Subtotal</span>
                  <span>{formatRupiah(order.subtotal)}</span>
                </div>

                {Number(
                  (order as { discount_amount?: number | null }).discount_amount ?? 0
                ) > 0 ? (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span>
                      Diskon voucher
                      {(order as { voucher_code?: string | null }).voucher_code
                        ? ` (${(order as { voucher_code?: string | null }).voucher_code})`
                        : ''}
                    </span>
                    <span>
                      −{' '}
                      {formatRupiah(
                        (order as { discount_amount?: number | null }).discount_amount ?? 0
                      )}
                    </span>
                  </div>
                ) : null}

                <div className="flex items-center justify-between text-neutral-600">
                  <span>Ongkir</span>
                  <span>{formatRupiah(order.shipping_cost)}</span>
                </div>

                <div className="flex items-center justify-between text-neutral-600">
                  <span>Pengiriman</span>
                  <span>{order.shipping_method_name || '-'}</span>
                </div>

                <div className="flex items-center justify-between text-neutral-600">
                  <span>Metode bayar</span>
                  <span>{getPaymentMethodLabel(invoice.payment_method)}</span>
                </div>

                <div className="flex items-center justify-between border-t border-neutral-200 pt-3 text-base font-bold text-neutral-900">
                  <span>Total</span>
                  <span>{formatRupiah(invoice.total)}</span>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-bold text-neutral-900">Simpan halaman ini</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                Tanpa perlu akun: link halaman ini (dengan kuncinya) adalah
                satu-satunya cara membuka kembali pesananmu. Simpan baik-baik.
              </p>
              <div className="mt-4">
                <InvoiceShareButtons
                  invoicePath={invoicePath}
                  invoiceNumber={invoice.invoice_number}
                  storeName={store.name}
                  storeWhatsapp={store.whatsapp}
                />
              </div>
              <Link
                href={`/${store.slug}`}
                className="mt-4 block w-full rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-center text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
              >
                Kembali ke toko {store.name}
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
