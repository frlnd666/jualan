import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProductDetailClient from '@/components/ProductDetailClient'

export default async function ProductDetailPage({ params }: { params: { storeSlug: string; slug: string } }) {
  const supabase = await createClient()

  const { data: store } = await supabase
    .from('stores')
    .select('id, slug')
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

  return <ProductDetailClient storeSlug={store.slug} product={product} />
}