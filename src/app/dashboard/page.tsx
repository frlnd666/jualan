import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores')
    .select('id, name, slug')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    redirect('/dashboard/settings')
  }

  const { count: productCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', store.id)

  const { count: orderCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', store.id)

  const { count: pendingCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', store.id)
    .eq('status', 'PENDING_PAYMENT')

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Overview</h1>
      <p className="text-sm text-gray-500 mb-6">Selamat datang, {user.email}</p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Total Produk</p>
          <p className="text-2xl font-bold text-gray-900">{productCount ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Total Pesanan</p>
          <p className="text-2xl font-bold text-gray-900">{orderCount ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 col-span-2">
          <p className="text-xs text-gray-500 mb-1">Menunggu Pembayaran</p>
          <p className="text-2xl font-bold text-indigo-600">{pendingCount ?? 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/dashboard/products"
          className="bg-indigo-600 text-white rounded-2xl p-4 text-sm font-semibold text-center hover:bg-indigo-700 transition"
        >
          + Tambah Produk
        </Link>
        <Link
          href="/dashboard/orders"
          className="bg-white border border-gray-200 text-gray-700 rounded-2xl p-4 text-sm font-semibold text-center hover:bg-gray-50 transition"
        >
          Lihat Pesanan
        </Link>
      </div>
    </div>
  )
}