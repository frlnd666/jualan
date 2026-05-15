import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ConfirmPaymentButton from '@/components/dashboard/ConfirmPaymentButton'

type DashboardPaymentsPageProps = {
  searchParams: Promise<{
    orderId?: string
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

function InvoiceCard({ invoice }: { invoice: any }) {
  const order = invoice.orders

  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_300px]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Invoice
              </p>
              <h2 className="mt-1 text-lg font-bold text-gray-900">
                {invoice.invoice_number}
              </h2>
              <p className="mt-1 text-sm text-gray-700">
                {order?.customer_name || '-'}
              </p>
              <p className="text-sm text-gray-500">
                {order?.customer_phone || '-'}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {new Date(invoice.created_at).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 md:flex-col">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getPaymentStatusStyle(invoice.payment_status)}`}
              >
                {getPaymentStatusLabel(invoice.payment_status)}
              </span>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getOrderStatusStyle(order?.status || '')}`}
              >
                {getOrderStatusLabel(order?.status || '-')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Total
              </p>
              <p className="mt-1 text-sm font-bold text-gray-900">
                Rp {Number(invoice.total).toLocaleString('id-ID')}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Metode
              </p>
              <p className="mt-1 text-sm font-bold text-gray-900">
                {getPaymentMethodLabel(invoice.payment_method)}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Pengiriman
              </p>
              <p className="mt-1 text-sm font-bold text-gray-900">
                {order?.shipping_method_name || '-'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
  <Link
    href={`/invoice/${invoice.invoice_number}`}
    className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50"
  >
    Preview invoice
  </Link>

  <Link
    href={`/dashboard/payments/${invoice.invoice_number}`}
    className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
  >
    Detail pembayaran
  </Link>
</div>
        </div>

        <aside className="space-y-3">
          <div className="rounded-3xl border border-gray-100 bg-gray-50 p-4">
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
          </div>

          <ConfirmPaymentButton
            invoiceId={invoice.id}
            orderId={invoice.order_id}
            invoiceNumber={invoice.invoice_number}
            disabled={
              !invoice.payment_proof_url ||
              invoice.payment_status === 'PAID'
            }
          />
        </aside>
      </div>
    </section>
  )
}

export default async function DashboardPaymentsPage({
  searchParams,
}: DashboardPaymentsPageProps) {
  const { orderId } = await searchParams
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
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Pembayaran</h1>
        <p className="mt-2 text-sm text-gray-500">
          Toko tidak ditemukan untuk akun ini.
        </p>
      </div>
    )
  }

  const { data: invoices, error: invoicesError } = await supabase
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
        status,
        shipping_method_name,
        created_at
      )
    `)
    .order('created_at', { ascending: false })

  if (invoicesError) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-rose-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Pembayaran</h1>
        <p className="mt-2 text-sm text-rose-600">Gagal memuat data pembayaran.</p>
      </div>
    )
  }

  const storeInvoices = (invoices || []).filter(
    (invoice: any) => invoice.orders?.store_id === store.id,
  )

  const selectedInvoices = orderId
    ? storeInvoices.filter((invoice: any) => invoice.order_id === orderId)
    : storeInvoices

  const activeInvoice = orderId ? selectedInvoices[0] ?? null : null

  const totalInvoices = storeInvoices.length
  const pendingPayments = storeInvoices.filter(
    (inv: any) => inv.payment_status === 'PENDING_PAYMENT' && inv.payment_proof_url,
  ).length
  const paidPayments = storeInvoices.filter(
    (inv: any) => inv.payment_status === 'PAID',
  ).length

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Verifikasi pembayaran
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Cek bukti transfer customer lalu konfirmasi pembayaran untuk memproses pesanan.
        </p>
      </div>

      {!orderId && (
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Total invoice
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{totalInvoices}</p>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Perlu dikonfirmasi
            </p>
            <p className="mt-2 text-2xl font-bold text-amber-600">
              {pendingPayments}
            </p>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Sudah dikonfirmasi
            </p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">{paidPayments}</p>
          </div>
        </section>
      )}

      {orderId && (
        <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">
            Menampilkan pembayaran untuk order terpilih
          </p>
          <Link
            href="/dashboard/payments"
            className="inline-flex items-center justify-center rounded-2xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50"
          >
            Tampilkan semua
          </Link>
        </div>
      )}

      {orderId ? (
        activeInvoice ? (
          <InvoiceCard invoice={activeInvoice} />
        ) : (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500">
            Tidak ada pembayaran yang cocok dengan order ini.
          </div>
        )
      ) : storeInvoices.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500">
          Belum ada pembayaran yang masuk.
        </div>
      ) : (
        <div className="grid gap-4">
          {storeInvoices.map((invoice: any) => (
            <InvoiceCard key={invoice.id} invoice={invoice} />
          ))}
        </div>
      )}
    </div>
  )
}