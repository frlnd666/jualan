import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import UploadPaymentProofForm from '@/components/invoice/UploadPaymentProofForm'

type InvoicePageProps = {
  params: Promise<{
    invoiceNumber: string
  }>
}

function getPaymentMethodLabel(method: string | null) {
  switch (method) {
    case 'BANK_TRANSFER':
      return 'Transfer bank'
    case 'QRIS':
      return 'QRIS'
    case 'COD':
      return 'COD'
    default:
      return '-'
  }
}

function getPaymentStatusLabel(status: string) {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'Menunggu pembayaran'
    case 'PAID':
      return 'Sudah dibayar'
    case 'FAILED':
      return 'Pembayaran gagal'
    case 'REFUNDED':
      return 'Dana dikembalikan'
    default:
      return status || '-'
  }
}

function getOrderStatusLabel(status: string) {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'Menunggu pembayaran'
    case 'PAID':
      return 'Sudah dibayar'
    case 'PROCESSING':
      return 'Sedang diproses'
    case 'SHIPPED':
      return 'Sedang dikirim'
    case 'COMPLETED':
      return 'Selesai'
    case 'CANCELLED':
      return 'Dibatalkan'
    default:
      return status || '-'
  }
}

export default async function InvoicePage({ params }: InvoicePageProps) {
  const { invoiceNumber } = await params
  const supabase = await createClient()

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
      slug
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

  const paymentMethodLabel = getPaymentMethodLabel(invoice.payment_method)
  const paymentStatusLabel = getPaymentStatusLabel(invoice.payment_status)
  const orderStatusLabel = getOrderStatusLabel(order.status)

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Invoice</p>
              <h1 className="mt-1 text-2xl font-bold text-neutral-900">
                {invoice.invoice_number}
              </h1>
              <p className="mt-2 text-sm text-neutral-600">
                Pesanan berhasil dibuat. Simpan nomor invoice ini untuk tracking
                dan konfirmasi pembayaran.
              </p>
            </div>

            <div className="grid gap-3 text-sm md:min-w-[280px]">
              <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                <p className="text-neutral-500">Status pembayaran</p>
                <p className="mt-1 font-semibold text-neutral-900">
                  {paymentStatusLabel}
                </p>
              </div>

              <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                <p className="text-neutral-500">Status order</p>
                <p className="mt-1 font-semibold text-neutral-900">
                  {orderStatusLabel}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-bold text-neutral-900">Data customer</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Nama
                  </p>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">
                    {order.customer_name}
                  </p>
                </div>

                <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    WhatsApp
                  </p>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">
                    {order.customer_phone}
                  </p>
                </div>

                <div className="rounded-2xl bg-neutral-50 px-4 py-3 md:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Alamat
                  </p>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">
                    {order.address}
                  </p>
                  <p className="mt-2 text-sm text-neutral-600">
                    {order.city}, {order.province} {order.postal_code}
                  </p>
                </div>

                <div className="rounded-2xl bg-neutral-50 px-4 py-3 md:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Catatan
                  </p>
                  <p className="mt-1 text-sm text-neutral-900">
                    {order.notes || '-'}
                  </p>
                </div>
              </div>
            </section>

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
                        {item.qty} x Rp {Number(item.price).toLocaleString('id-ID')}
                      </p>
                      {item.notes ? (
                        <p className="mt-2 text-xs text-neutral-500">
                          Catatan: {item.notes}
                        </p>
                      ) : null}
                    </div>

                    <p className="shrink-0 text-sm font-semibold text-neutral-900">
                      Rp {Number(item.subtotal).toLocaleString('id-ID')}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-bold text-neutral-900">Ringkasan pembayaran</h2>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between text-neutral-600">
                  <span>Subtotal</span>
                  <span>Rp {Number(order.subtotal).toLocaleString('id-ID')}</span>
                </div>

                <div className="flex items-center justify-between text-neutral-600">
                  <span>Ongkir</span>
                  <span>Rp {Number(order.shipping_cost).toLocaleString('id-ID')}</span>
                </div>

                <div className="flex items-center justify-between text-neutral-600">
                  <span>Pengiriman</span>
                  <span>{order.shipping_method_name || '-'}</span>
                </div>

                <div className="flex items-center justify-between text-neutral-600">
                  <span>Metode bayar</span>
                  <span>{paymentMethodLabel}</span>
                </div>

                <div className="flex items-center justify-between border-t border-neutral-200 pt-3 text-base font-bold text-neutral-900">
                  <span>Total</span>
                  <span>Rp {Number(invoice.total).toLocaleString('id-ID')}</span>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-bold text-neutral-900">Aksi berikutnya</h2>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                  Lakukan pembayaran sesuai metode yang dipilih, lalu simpan nomor
                  invoice ini.
                </div>

                <Link
                  href={`/track/${invoice.invoice_number}`}
                  className="block w-full rounded-2xl bg-indigo-600 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Lacak pesanan
                </Link>

                <Link
                  href={`/${store.slug}`}
                  className="block w-full rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-center text-sm font-semibold text-neutral-900"
                >
                  Kembali ke toko
                </Link>
              </div>
            </section>

            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 md:p-6">
              <h2 className="text-base font-bold text-amber-900">Upload bukti transfer</h2>
              <p className="mt-2 text-sm text-amber-800">
                Setelah transfer, upload bukti pembayaran agar seller lebih mudah
                melakukan verifikasi.
              </p>

              <div className="mt-4">
                <UploadPaymentProofForm
                  invoiceId={invoice.id}
                  invoiceNumber={invoice.invoice_number}
                  paymentProofUrl={invoice.payment_proof_url}
                />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}