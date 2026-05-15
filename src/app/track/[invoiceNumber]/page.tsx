import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type TrackPageProps = {
  params: Promise<{
    invoiceNumber: string
  }>
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

function getShipmentStatusLabel(status: string | null) {
  switch (status) {
    case 'PENDING':
      return 'Menunggu diproses'
    case 'PROCESSING':
      return 'Sedang diproses'
    case 'SHIPPED':
      return 'Sedang dikirim'
    case 'DELIVERED':
      return 'Sudah diterima'
    case 'CANCELLED':
      return 'Dibatalkan'
    default:
      return status || '-'
  }
}

function buildTimeline(orderStatus: string, paymentStatus: string) {
  return [
    {
      key: 'order-created',
      title: 'Order dibuat',
      description: 'Pesanan sudah masuk ke sistem dan invoice berhasil dibuat.',
      done: true,
      active: false,
    },
    {
      key: 'waiting-payment',
      title: 'Menunggu pembayaran',
      description: 'Customer perlu menyelesaikan pembayaran sesuai metode yang dipilih.',
      done: paymentStatus === 'PENDING_PAYMENT' || paymentStatus === 'PAID',
      active: paymentStatus === 'PENDING_PAYMENT',
    },
    {
      key: 'paid',
      title: 'Pembayaran terkonfirmasi',
      description: 'Pembayaran telah diterima dan order siap diproses seller.',
      done:
        paymentStatus === 'PAID' ||
        ['PROCESSING', 'SHIPPED', 'COMPLETED'].includes(orderStatus),
      active: paymentStatus === 'PAID' && orderStatus === 'PAID',
    },
    {
      key: 'processing',
      title: 'Order diproses',
      description: 'Seller sedang menyiapkan produk untuk dikirim.',
      done: ['PROCESSING', 'SHIPPED', 'COMPLETED'].includes(orderStatus),
      active: orderStatus === 'PROCESSING',
    },
    {
      key: 'shipped',
      title: 'Order dikirim',
      description: 'Pesanan sudah dikirim atau sedang dalam perjalanan.',
      done: ['SHIPPED', 'COMPLETED'].includes(orderStatus),
      active: orderStatus === 'SHIPPED',
    },
    {
      key: 'completed',
      title: 'Order selesai',
      description: 'Pesanan sudah diterima atau ditandai selesai.',
      done: orderStatus === 'COMPLETED',
      active: orderStatus === 'COMPLETED',
    },
  ]
}

export default async function TrackOrderPage({ params }: TrackPageProps) {
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
      created_at,
      updated_at
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

  const { data: shipment } = await supabase
    .from('shipments')
    .select(`
      id,
      order_id,
      courier,
      tracking_number,
      status
    `)
    .eq('order_id', order.id)
    .maybeSingle()

  const timeline = buildTimeline(order.status, invoice.payment_status)

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Tracking pesanan</p>
              <h1 className="mt-1 text-2xl font-bold text-neutral-900">
                {invoice.invoice_number}
              </h1>
              <p className="mt-2 text-sm text-neutral-600">
                Halaman ini menampilkan status pembayaran, progres order, dan
                informasi pengiriman customer.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Payment
                </p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">
                  {getPaymentStatusLabel(invoice.payment_status)}
                </p>
              </div>

              <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Order
                </p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">
                  {getOrderStatusLabel(order.status)}
                </p>
              </div>

              <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Payment method
                </p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">
                  {getPaymentMethodLabel(invoice.payment_method)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-bold text-neutral-900">Timeline order</h2>

              <div className="mt-5 space-y-4">
                {timeline.map((step, index) => (
                  <div key={step.key} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                          step.done
                            ? 'bg-indigo-600 text-white'
                            : step.active
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-neutral-100 text-neutral-400'
                        }`}
                      >
                        {index + 1}
                      </div>
                      {index < timeline.length - 1 ? (
                        <div className="mt-2 h-full w-px bg-neutral-200" />
                      ) : null}
                    </div>

                    <div className="pb-6">
                      <p className="text-sm font-semibold text-neutral-900">
                        {step.title}
                      </p>
                      <p className="mt-1 text-sm text-neutral-600">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-bold text-neutral-900">Informasi customer</h2>

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
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-bold text-neutral-900">Ringkasan order</h2>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between text-neutral-600">
                  <span>Invoice</span>
                  <span className="font-medium text-neutral-900">
                    {invoice.invoice_number}
                  </span>
                </div>

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

                <div className="flex items-center justify-between border-t border-neutral-200 pt-3 text-base font-bold text-neutral-900">
                  <span>Total</span>
                  <span>Rp {Number(invoice.total).toLocaleString('id-ID')}</span>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-bold text-neutral-900">Status pengiriman</h2>

              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Kurir
                  </p>
                  <p className="mt-1 font-semibold text-neutral-900">
                    {shipment?.courier || order.shipping_method_name || '-'}
                  </p>
                </div>

                <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Nomor resi
                  </p>
                  <p className="mt-1 font-semibold text-neutral-900">
                    {shipment?.tracking_number || '-'}
                  </p>
                </div>

                <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Status shipment
                  </p>
                  <p className="mt-1 font-semibold text-neutral-900">
                    {getShipmentStatusLabel(shipment?.status || null)}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-bold text-neutral-900">Navigasi</h2>

              <div className="mt-4 space-y-3">
                <Link
                  href={`/invoice/${invoice.invoice_number}`}
                  className="block w-full rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-center text-sm font-semibold text-neutral-900"
                >
                  Lihat invoice
                </Link>

                <Link
                  href={`/${store.slug}`}
                  className="block w-full rounded-2xl bg-indigo-600 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Kembali ke toko
                </Link>
              </div>
            </section>

            <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 md:p-6">
              <h2 className="text-base font-bold text-blue-900">Chat seller</h2>
              <p className="mt-2 text-sm text-blue-800">
                Panel chat order-based bisa kita sambungkan setelah tracking page
                ini selesai stabil.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}