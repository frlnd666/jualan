import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProductDetailClient from '@/components/ProductDetailClient'
import { getPublicStoreSubscription } from '@/lib/subscriptions-server'
import { limitsFor } from '@/lib/subscription-tiers'

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

  // Fase 1 (Bab 5): downgrade menyembunyikan, bukan menghapus — produk di
  // atas batas paket tidak bisa dibuka lewat URL langsung, dan foto ke-2+
  // tidak ditampilkan untuk Free.
  const subscription = await getPublicStoreSubscription(store.id)
  if (subscription.status === 'SUSPENDED') {
    notFound()
  }
  const tierLimits = limitsFor(subscription)
  const { data: visibleSlugs } = await supabase
    .from('products')
    .select('slug')
    .eq('store_id', store.id)
    .eq('available', true)
    .order('created_at', { ascending: false })
    .limit(tierLimits.maxProducts)
  const isVisible = (visibleSlugs ?? []).some((p) => p.slug === slug)
  if (!isVisible) {
    notFound()
  }

  return (
    <ProductDetailClient
      storeSlug={store.slug}
      product={{
        ...product,
        images: (product.images ?? []).slice(
          0,
          tierLimits.maxPhotosPerProduct
        ),
      }}
    />
  )
}