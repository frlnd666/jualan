import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function InvoicePage({ params }: { params: { invoiceNumber: string } }) {
  const supabase = await createClient()

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, orders(*, order_items(*), stores(name, whatsapp))')
    .eq('invoice_number', params.invoiceNumber)
    .single()

  if (!invoice) notFound()

  const order = invoice.orders as any
  const store = order.stores as any

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-xl mx-auto space-y-4">
        <div className="bg-white rounded-2xl p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-lg font-bold text-gray-900">{store.name}</h1>
              <p className="text-xs text-gray-500">Invoice</p>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
              invoice.payment_status === 'PAID'
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {invoice.payment_status === 'PAID' ? 'Sudah Bayar' : 'Belum Bayar'}
            </span>
          </div>

          <p className="text-sm font-mono text-gray-700 mb-4">{invoice.invoice_number}</p>

          <div className="border-t border-gray-100 pt-4 space-y-1">
            <p className="text-sm font-medium text-gray-900">Info Pembeli</p>
            <p className="text-sm text-gray-600">{order.customer_name}</p>
            <p className="text-sm text-gray-600">{order.customer_phone}</p>
            <p className="text-sm text-gray-600">{order.address}, {order.city}, {order.province} {order.postal_code}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5">
          <p className="text-sm font-medium text-gray-900 mb-3">Produk</p>
          <div className="space-y-2">
            {order.order_items.map((item: any) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-700">{item.product_name} x{item.qty}</span>
                <span className="font-medium">Rp {Number(item.price * item.qty).toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>Rp {Number(order.subtotal).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Ongkir ({order.shipping_method_name})</span>
              <span>Rp {Number(order.shipping_cost).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900">
              <span>Total</span>
              <span>Rp {Number(order.total).toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5">
          <p className="text-sm font-medium text-gray-900 mb-2">Cara Bayar</p>
          <p className="text-sm text-gray-600 capitalize">{order.payment_method.replace('_', ' ')}</p>
          <p className="text-xs text-gray-400 mt-1">Status: {order.status}</p>
        </div>
      </div>
    </div>
  )
}