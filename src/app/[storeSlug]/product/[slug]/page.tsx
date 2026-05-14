import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function ProductDetailPage({ params }: { params: { storeSlug: string; slug: string } }) {
  const supabase = await createClient()

  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('slug', params.storeSlug)
    .single()

  if (!store) notFound()

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', store.id)
    .eq('slug', params.slug)
    .single()

  if (!product) notFound()

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-2xl mx-auto bg-white">
        {product.images?.[0] && <img src={product.images[0]} alt={product.name} className="w-full h-80 object-cover" />}
        <div className="p-4 space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            <p className="text-xl font-bold text-indigo-600 mt-2">Rp {Number(product.price).toLocaleString('id-ID')}</p>
          </div>
          <p className="text-sm text-gray-600">{product.description}</p>
          <Link href="/cart" className="block text-center bg-indigo-600 text-white rounded-xl py-3 font-semibold">
            Tambah ke Cart
          </Link>
        </div>
      </div>
    </div>
  )
}