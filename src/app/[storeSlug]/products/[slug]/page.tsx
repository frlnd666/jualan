import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProductDetailClient from '@/components/ProductDetailClient'

type ProductDetailPageProps = {
  params: Promise<{
    storeSlug: string
    slug: string
  }>
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { storeSlug, slug } = await params
  const supabase = await createClient()

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, slug')
    .eq('slug', storeSlug)
    .maybeSingle()

  if (storeError || !store) {
    notFound()
  }

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', store.id)
    .eq('slug', slug)
    .maybeSingle()

  if (productError || !product) {
    notFound()
  }

  return <ProductDetailClient storeSlug={store.slug} product={product} />
}