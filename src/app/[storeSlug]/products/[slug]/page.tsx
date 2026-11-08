import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProductDetailClient from '@/components/ProductDetailClient'
import { getPublicStoreSubscription } from '@/lib/subscriptions-server'
import { limitsFor } from '@/lib/subscription-tiers'
import {
  activeFlashSaleForProduct,
  type FlashSaleLike,
} from '@/lib/flash-sales'

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

  // Fase 4 — flash sale aktif produk ini (bila tabel f4 belum ada,
  // abaikan — harga normal). Watermark foto untuk paket Free.
  let flashSale: FlashSaleLike | null = null
  try {
    const { data: flashRows } = await supabase
      .from('flash_sales')
      .select('id, store_id, product_id, promo_price, starts_at, ends_at, is_active')
      .eq('store_id', store.id)
      .eq('product_id', product.id)
      .eq('is_active', true)
    flashSale = activeFlashSaleForProduct(
      ((flashRows ?? []) as FlashSaleLike[]).map((s) => ({
        ...s,
        promo_price: Number(s.promo_price),
      })),
      product.id,
      new Date()
    )
  } catch {
    flashSale = null
  }

  return (
    <ProductDetailClient
      storeSlug={store.slug}
      flashSale={flashSale}
      watermarked={tierLimits.watermark}
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