import Image from 'next/image'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ConfirmPaymentButton from '@/components/dashboard/ConfirmPaymentButton'

type DashboardPaymentDetailPageProps = {
  params: Promise<{
    invoiceNumber: string
  }>
}

function formatRupiah(value: number | string | null | undefined) {
  const numberValue = Number(value ?? 0)

  if (Number.isNaN(numberValue)) return '0'

  return numberValue.toString().replace(/B(?=(d{3})+(?!d))/g, '.')
}

function formatDate(dateValue: string | null | undefined) {
  if (!dateValue) return '-'

  const date = new Date(dateValue)

  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
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

function getPaymentStatusStyle(status: string) {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'PAID':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'FAILED':
      return 'bg-rose-50 text-rose-700 border-rose-200'
    case 'REFUNDED':
      return 'bg-sky-50 text-sky-700 border-sky-200'
    default:
      return 'bg-neutral-100 text-neutral-700 border-neutral-200'
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

function getOrderStatusStyle(status: string) {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'PAID':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'PROCESSING':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    case 'SHIPPED':
      return 'bg-sky-50 text-sky-700 border-sky-200'
    case 'COMPLETED':
      return 'bg-neutral-100 text-neutral-700 border-neutral-200'
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700 border-rose-200'
    default:
      return 'bg-neutral-100 text-neutral-700 border-neutral-200'
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
      return method || '-'
  }
}

export default async function DashboardPaymentDetailPage({
  params,
}: DashboardPaymentDetailPageProps) {
  const { invoiceNumber } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, name, slug, owner_id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (storeError || !store) {
    notFound()
  }

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
      created_at,
      orders (
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
        shipping_method_name,
        created_at
      )
    `)
    .eq('invoice_number', invoiceNumber)
    .maybeSingle()

  if (invoiceError || !invoice || invoice.orders?.store_id !== store.id) {
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
    .eq('order_id', invoice.order_id)
    .order('id', { ascending: true })

  if (itemsError) {
    notFound()
  }

  const order = invoice.orders

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">Detail pembayaran</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
            {invoice.invoice_number}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Verifikasi pembayaran customer dan cek detail pesanan dari dashboard seller.
          </p>
        </div>

        <Link
          href="/dashboard/payments"
          className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50"
        >
          Kembali ke pembayaran
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Total invoice
          </p>
          <p className="mt-2 text-xl font-bold text-gray-900">
            Rp {formatRupiah(invoice.total)}
          </p>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Metode bayar
          </p>
          <p className="mt-2 text-xl font-bold text-gray-900">
            {getPaymentMethodLabel(invoice.payment_method)}
          </p>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Status pembayaran
          </p>
          <span
            className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getPaymentStatusStyle(invoice.payment_status)}`}
          >
            {getPaymentStatusLabel(invoice.payment_status)}
          </span>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Status order
          </p>
          <span
            className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getOrderStatusStyle(order?.status || '')}`}
          >
            {getOrderStatusLabel(order?.status || '')}
          </span>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_360px]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-bold text-gray-900">Data customer</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Nama
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {order?.customer_name || '-'}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  WhatsApp
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {order?.customer_phone || '-'}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 px-4 py-3 md:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Alamat
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {order?.address || '-'}
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  {order?.city || '-'}, {order?.province || '-'} {order?.postal_code || ''}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Pengiriman
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {order?.shipping_method_name || '-'}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Tanggal order
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {formatDate(order?.created_at)}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 px-4 py-3 md:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Catatan
                </p>
                <p className="mt-1 text-sm text-gray-900">
                  {order?.notes || '-'}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-bold text-gray-900">Item pesanan</h2>

            <div className="mt-4 space-y-3">
              {(orderItems || []).map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 rounded-2xl bg-gray-50 px-4 py-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {item.product_name}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {item.qty} x Rp {formatRupiah(item.price)}
                    </p>
                    {item.notes ? (
                      <p className="mt-2 text-xs text-gray-500">
                        Catatan: {item.notes}
                      </p>
                    ) : null}
                  </div>

                  <p className="shrink-0 text-sm font-semibold text-gray-900">
                    Rp {formatRupiah(item.subtotal)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-bold text-gray-900">Ringkasan pembayaran</h2>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between text-gray-600">
                <span>Subtotal</span>
                <span>Rp {formatRupiah(order?.subtotal)}</span>
              </div>

              <div className="flex items-center justify-between text-gray-600">
                <span>Ongkir</span>
                <span>Rp {formatRupiah(order?.shipping_cost)}</span>
              </div>

              <div className="flex items-center justify-between text-gray-600">
                <span>Pengiriman</span>
                <span>{order?.shipping_method_name || '-'}</span>
              </div>

              <div className="flex items-center justify-between text-gray-600">
                <span>Metode bayar</span>
                <span>{getPaymentMethodLabel(invoice.payment_method)}</span>
              </div>

              <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-base font-bold text-gray-900">
                <span>Total</span>
                <span>Rp {formatRupiah(invoice.total)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-sm font-bold text-gray-900">Bukti transfer</p>

            {invoice.payment_proof_url ? (
              <div className="mt-3 space-y-3">
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                  <Image
                    src={invoice.payment_proof_url}
                    alt={`Bukti transfer ${invoice.invoice_number}`}
                    width={800}
                    height={1000}
                    className="h-auto w-full object-cover"
                  />
                </div>

                <a
                  href={invoice.payment_proof_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Buka gambar penuh
                </a>
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-400">
                Customer belum upload bukti transfer.
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-bold text-gray-900">Aksi seller</h2>

            <div className="mt-4 space-y-3">
              <ConfirmPaymentButton
                invoiceId={invoice.id}
                orderId={invoice.order_id}
                invoiceNumber={invoice.invoice_number}
                disabled={
                  !invoice.payment_proof_url ||
                  invoice.payment_status === 'PAID'
                }
              />

              <Link
                href={`/invoice/${invoice.invoice_number}`}
                className="block w-full rounded-2xl border border-gray-200 bg-white px-5 py-3 text-center text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                Preview invoice pembeli
              </Link>

              <Link
                href={`/track/${invoice.invoice_number}`}
                className="block w-full rounded-2xl border border-gray-200 bg-white px-5 py-3 text-center text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                Preview tracking pembeli
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}