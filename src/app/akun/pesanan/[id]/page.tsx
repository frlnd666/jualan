// Detail pesanan pembeli (Fase 2): item, status, pelacakan resi, dan
// tautan invoice (token diambil lewat policy invoices_buyer_select).
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
  getShipmentStatusLabel,
} from '@/lib/order-status'

type OrderRow = {
  id: string
  store_id: string
  customer_name: string
  address: string
  province: string
  city: string
  postal_code: string
  subtotal: number | string
  shipping_cost: number | string
  total: number | string
  status: string
  payment_method: string | null
  shipping_method_name: string | null
  created_at: string
}

export default async function BuyerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/akun/pesanan')

  const { data: orderData } = await supabase
    .from('orders')
    .select(
      'id, store_id, customer_name, address, province, city, postal_code, subtotal, shipping_cost, total, status, payment_method, shipping_method_name, created_at'
    )
    .eq('id', id)
    .eq('buyer_id', user.id)
    .maybeSingle()
  const order = orderData as OrderRow | null
  if (!order) redirect('/akun/pesanan')

  const { data: storeData } = await supabase
    .from('stores')
    .select('name, slug')
    .eq('id', order.store_id)
    .maybeSingle()
  const store = storeData as { name: string; slug: string } | null

  const { data: itemsData } = await supabase
    .from('order_items')
    .select('id, product_name, qty, price, subtotal')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true })
  const items = (itemsData ?? []) as Array<{
    id: string
    product_name: string
    qty: number
    price: number | string
    subtotal: number | string
  }>

  const { data: shipmentData } = await supabase
    .from('shipments')
    .select('courier, tracking_number, status, shipped_at')
    .eq('order_id', order.id)
    .maybeSingle()
  const shipment = shipmentData as {
    courier: string
    tracking_number: string
    status: string | null
    shipped_at: string | null
  } | null

  const { data: invoiceData } = await supabase
    .from('invoices')
    .select('invoice_number, payment_status, access_token')
    .eq('order_id', order.id)
    .maybeSingle()
  const invoice = invoiceData as {
    invoice_number: string
    payment_status: string
    access_token: string | null
  } | null

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link
          href="/akun/pesanan"
          className="text-sm font-semibold text-[var(--primary)]"
        >
          ← Semua pesanan
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text)]">
          {store?.name ?? 'Toko'}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {new Date(order.created_at).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'Asia/Jakarta',
          })}{' '}
          • {getOrderStatusLabel(order.status)}
        </p>
      </div>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
        <h2 className="text-base font-bold text-[var(--text)]">Item pesanan</h2>
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-soft)] px-4 py-3 text-sm"
            >
              <div>
                <p className="font-semibold text-[var(--text)]">
                  {item.product_name}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {item.qty} x Rp {Number(item.price).toLocaleString('id-ID')}
                </p>
              </div>
              <p className="font-bold text-[var(--text)]">
                Rp {Number(item.subtotal).toLocaleString('id-ID')}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-4 text-sm">
          <div className="flex justify-between text-[var(--text-muted)]">
            <span>Subtotal</span>
            <span>Rp {Number(order.subtotal).toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-[var(--text-muted)]">
            <span>Ongkir ({order.shipping_method_name ?? '-'})</span>
            <span>Rp {Number(order.shipping_cost).toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-[var(--text)]">
            <span>Total</span>
            <span>Rp {Number(order.total).toLocaleString('id-ID')}</span>
          </div>
          <p className="pt-1 text-xs text-[var(--text-muted)]">
            {getPaymentMethodLabel(order.payment_method)} •{' '}
            {invoice ? getPaymentStatusLabel(invoice.payment_status) : '-'}
          </p>
        </div>
      </section>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
        <h2 className="text-base font-bold text-[var(--text)]">Pelacakan</h2>
        {shipment ? (
          <div className="mt-3 space-y-2 text-sm">
            <p className="text-[var(--text)]">
              <span className="font-semibold">{shipment.courier}</span> •{' '}
              {shipment.tracking_number}
            </p>
            <p className="text-[var(--text-muted)]">
              {getShipmentStatusLabel(shipment.status)}
              {shipment.shipped_at
                ? ` • Dikirim ${new Date(shipment.shipped_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : ''}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Belum ada nomor resi — penjual akan menginput resi setelah
            pesanan dikirim.
          </p>
        )}
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Dikirim ke: {order.address}, {order.city}, {order.province}{' '}
          {order.postal_code}
        </p>
      </section>

      {invoice ? (
        <Link
          href={`/invoice/${invoice.invoice_number}${invoice.access_token ? `?t=${encodeURIComponent(invoice.access_token)}` : ''}`}
          className="block rounded-[28px] border border-[color:var(--primary-soft)] bg-[var(--primary)] p-4 text-center text-sm font-bold text-white shadow-[var(--shadow-sm)]"
        >
          Lihat invoice &amp; bayar / upload bukti
        </Link>
      ) : null}
    </div>
  )
}
