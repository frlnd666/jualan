import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) redirect('/dashboard/settings')

  const { data: orders } = await supabase
    .from('orders')
    .select('id, customer_name, total, status, created_at')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Pesanan</h1>

      <div className="space-y-3">
        {(orders ?? []).map((order) => (
          <div key={order.id} className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900">{order.customer_name}</p>
                <p className="text-sm text-gray-600">Rp {Number(order.total).toLocaleString('id-ID')}</p>
                <p className="text-xs text-gray-500">{order.status}</p>
              </div>
              <span className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('id-ID')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}