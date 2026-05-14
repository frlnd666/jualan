import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function StorefrontPage({ params }: { params: { storeSlug: string } }) {
  const supabase = await createClient()

  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('slug', params.storeSlug)
    .single()

  if (!store) notFound()

  const { data: products } = await supabase
    .from('products')
    .select('id, name, slug, price, images, badge')
    .eq('store_id', store.id)
    .eq('available', true)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white">
          {store.banner_url && <img src={store.banner_url} alt={store.name} className="w-full h-44 object-cover" />}
          <div className="p-4">
            {store.logo_url && <img src={store.logo_url} alt={store.name} className="h-12 w-12 rounded-2xl object-cover mb-3" />}
            <h1 className="text-xl font-bold text-gray-900">{store.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{store.description}</p>
          </div>
        </div>

        <div className="p-4 grid grid-cols-2 gap-3">
          {(products ?? []).map((product) => (
            <Link key={product.id} href={`/${store.slug}/product/${product.slug}`} className="bg-white rounded-2xl overflow-hidden border border-gray-100">
              <div className="aspect-square bg-gray-100">
                {product.images?.[0] && <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />}
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-gray-900 line-clamp-2">{product.name}</p>
                <p className="text-sm text-indigo-600 font-bold mt-1">Rp {Number(product.price).toLocaleString('id-ID')}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}