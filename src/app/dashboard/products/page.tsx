import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) redirect('/dashboard/settings')

  const { data: products } = await supabase
    .from('products')
    .select('id, name, slug, price, stock, available, created_at')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Produk</h1>
        <Link href="/dashboard/products/new" className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold">
          + Tambah
        </Link>
      </div>

      <div className="space-y-3">
        {(products ?? []).map((product) => (
          <div key={product.id} className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900">{product.name}</p>
                <p className="text-xs text-gray-500">/{product.slug}</p>
                <p className="text-sm text-gray-600 mt-1">Rp {Number(product.price).toLocaleString('id-ID')}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                {product.available ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}