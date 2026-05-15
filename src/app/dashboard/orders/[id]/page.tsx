import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type DashboardOrderDetailPageProps = {
  params: Promise<{
    id: string
  }>
}

type OrderItem = {
  id: string
  order_id: string
  product_id: string | null
  product_name: string | null
  qty: number
  price: number | string | null
  subtotal: number | string | null
  notes: string | null
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

function getPaymentStatusLabel(status: string | null) {
  switch (status) {
    case 'PENDING':
      return 'Menunggu pembayaran'
    case 'WAITING_VERIFICATION':
      return 'Menunggu verifikasi'
    case 'VERIFIED':
      return 'Sudah diverifikasi'
    case 'REJECTED':
      return 'Ditolak'
    case 'EXPIRED':
      return 'Kadaluarsa'
    default:
      return status || '-'
  }
}

function getPaymentStatusStyle(status: string | null) {
  switch (status) {
    case 'PENDING':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'WAITING_VERIFICATION':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    case 'VERIFIED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'REJECTED':
      return 'bg-rose-50 text-rose-700 border-rose-200'
    case 'EXPIRED':
      return 'bg-neutral-100 text-neutral-600 border-neutral-200'
    default:
      return 'bg-neutral-100 text-neutral-600 border-neutral-200'
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

export default async function DashboardOrderDetailPage({
  params,
}: DashboardOrderDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, slug')
    .eq('owner_id', user.id)
    .single()

  if (storeError || !store) {
    redirect('/dashboard/settings')
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
    .eq('id', id)
    .eq('store_id', store.id)
    .maybeSingle()

  if (orderError || !order) {
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

  const { data: invoice } = await supabase
    .from('invoices')
    .select(`
      id,
      invoice_number,
      payment_status,
      payment_proof_url,
      total,
      created_at
    `)
    .eq('order_id', order.id)
    .maybeSingle()

  const hasItems = (orderItems ?? []).length > 0

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">Detail pesanan</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
            Order #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Dibuat pada {formatDate(order.created_at)}
          </p>
        </div>

        <Link
          href="/dashboard/orders"
          className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50"
        >
          ← Kembali ke pesanan
        </Link>
      </div>

      {/* Stats bar */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Total order
          </p>
          <p className="mt-2 text-xl font-bold text-gray-900">
            Rp {formatRupiah(order.total)}
          </p>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Status order
          </p>
          <span
            className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getOrderStatusStyle(order.status)}`}
          >
            {getOrderStatusLabel(order.status)}
          </span>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Status pembayaran
          </p>
          {invoice?.payment_status ? (
            <span
              className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getPaymentStatusStyle(invoice.payment_status)}`}
            >
              {getPaymentStatusLabel(invoice.payment_status)}
            </span>
          ) : (
            <p className="mt-2 text-sm font-semibold text-gray-400">-</p>
          )}
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Metode bayar
          </p>
          <p className="mt-2 text-sm font-bold text-gray-900">
            {getPaymentMethodLabel(order.payment_method)}
          </p>
        </div>
      </section>

      {/* Bukti transfer banner jika ada */}
      {invoice?.payment_proof_url ? (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-emerald-900">
                Bukti transfer sudah diupload
              </h2>
              <p className="mt-1 text-sm text-emerald-800">
                Customer sudah mengupload bukti pembayaran. Silakan verifikasi di halaman detail pembayaran.
              </p>
            </div>
            {invoice?.invoice_number ? (
              <Link
                href={`/dashboard/payments/${invoice.invoice_number}`}
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                Verifikasi pembayaran
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Menunggu verifikasi banner */}
      {invoice?.payment_status === 'WAITING_VERIFICATION' &&
      !invoice?.payment_proof_url ? (
        <section className="rounded-3xl border border-indigo-200 bg-indigo-50 p-4 md:p-5">
          <p className="text-sm font-bold text-indigo-900">
            Menunggu verifikasi pembayaran
          </p>
          <p className="mt-1 text-sm text-indigo-800">
            Pembayaran sedang menunggu verifikasi dari seller.
          </p>
        </section>
      ) : null}

      {/* Body grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Kolom kiri */}
        <div className="space-y-6">
          {/* Data customer */}
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-bold text-gray-900">Data customer</h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Nama
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {order.customer_name || '-'}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  WhatsApp
                </p>
                {order.customer_phone ? (
                  <a
                    href={`https://wa.me/${order.customer_phone.replace(/D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-sm font-semibold text-indigo-600 hover:underline"
                  >
                    {order.customer_phone}
                  </a>
                ) : (
                  <p className="mt-1 text-sm font-semibold text-gray-900">-</p>
                )}
              </div>

              <div className="rounded-2xl bg-gray-50 px-4 py-3 sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Alamat lengkap
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {order.address || '-'}
                </p>
                {(order.city || order.province) && (
                  <p className="mt-1 text-sm text-gray-600">
                    {[order.city, order.province, order.postal_code]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-gray-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Pengiriman
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {order.shipping_method_name || '-'}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Invoice
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {invoice?.invoice_number || '-'}
                </p>
              </div>

              {order.notes ? (
                <div className="rounded-2xl bg-gray-50 px-4 py-3 sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Catatan customer
                  </p>
                  <p className="mt-1 text-sm text-gray-900">{order.notes}</p>
                </div>
              ) : null}
            </div>
          </section>

          {/* Item pesanan */}
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Item pesanan</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Daftar produk yang dipesan customer pada order ini.
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 px-3 py-2 text-right">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  Jml item
                </p>
                <p className="mt-1 text-sm font-bold text-gray-900">
                  {orderItems?.length ?? 0}
                </p>
              </div>
            </div>

            {!hasItems ? (
              <div className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-5">
                <p className="text-sm font-semibold text-amber-900">
                  Item pesanan belum tersedia
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  Order ini belum memiliki data item, atau data item belum tersimpan saat proses checkout.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {invoice?.invoice_number ? (
                    <Link
                      href={`/dashboard/payments/${invoice.invoice_number}`}
                      className="inline-flex items-center justify-center rounded-2xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                    >
                      Cek pembayaran terkait
                    </Link>
                  ) : null}
                  <Link
                    href="/dashboard/orders"
                    className="inline-flex items-center justify-center rounded-2xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                  >
                    Kembali ke daftar pesanan
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {(orderItems as OrderItem[]).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-4 rounded-2xl bg-gray-50 px-4 py-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {item.product_name || 'Produk tanpa nama'}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {item.qty} x Rp {formatRupiah(item.price)}
                      </p>
                      {item.notes ? (
                        <p className="mt-2 rounded-xl bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                          Catatan: {item.notes}
                        </p>
                      ) : null}
                    </div>

                    <p className="shrink-0 text-sm font-bold text-gray-900">
                      Rp {formatRupiah(item.subtotal)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Kolom kanan */}
        <aside className="space-y-6">
          {/* Ringkasan biaya */}
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-bold text-gray-900">Ringkasan biaya</h2>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between text-gray-600">
                <span>Subtotal produk</span>
                <span>Rp {formatRupiah(order.subtotal)}</span>
              </div>

              <div className="flex items-center justify-between text-gray-600">
                <span>Ongkos kirim</span>
                <span>Rp {formatRupiah(order.shipping_cost)}</span>
              </div>

              <div className="flex items-center justify-between text-gray-600">
                <span>Kurir</span>
                <span className="text-right">{order.shipping_method_name || '-'}</span>
              </div>

              <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-base font-bold text-gray-900">
                <span>Total</span>
                <span>Rp {formatRupiah(order.total)}</span>
              </div>
            </div>
          </section>

          {/* Aksi seller */}
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-bold text-gray-900">Aksi seller</h2>

            <div className="mt-4 space-y-3">
              {invoice ? (
                <>
                  <Link
                    href={`/dashboard/payments/${invoice.invoice_number}`}
                    className="block w-full rounded-2xl bg-indigo-600 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Detail pembayaran
                  </Link>

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
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm text-gray-500">
                  Invoice untuk order ini belum tersedia.
                </div>
              )}
            </div>
          </section>

          {/* Info invoice */}
          {invoice ? (
            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-base font-bold text-gray-900">Info invoice</h2>

              <div className="mt-3 space-y-3 text-sm">
                <div className="flex items-center justify-between text-gray-600">
                  <span className="text-gray-500">Nomor invoice</span>
                  <span className="font-semibold text-gray-900">
                    {invoice.invoice_number}
                  </span>
                </div>

                <div className="flex items-center justify-between text-gray-600">
                  <span className="text-gray-500">Dibuat</span>
                  <span className="font-semibold text-gray-900">
                    {formatDate(invoice.created_at)}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2 text-gray-600">
                  <span className="shrink-0 text-gray-500">Status bayar</span>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getPaymentStatusStyle(invoice.payment_status)}`}
                  >
                    {getPaymentStatusLabel(invoice.payment_status)}
                  </span>
                </div>

                {invoice.payment_proof_url ? (
                  <div className="pt-1">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Bukti transfer
                    </p>
                    <a
                      href={invoice.payment_proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-2xl border border-gray-100"
                    >
                      <img
                        src={invoice.payment_proof_url}
                        alt="Bukti transfer"
                        className="w-full object-cover"
                        loading="lazy"
                      />
                    </a>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  )
}