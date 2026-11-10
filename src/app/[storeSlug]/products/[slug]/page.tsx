import type { Metadata } from 'next'
import { cache } from 'react'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProductDetailClient from '@/components/ProductDetailClient'
import { getPublicStoreSubscription } from '@/lib/subscriptions-server'
import { limitsFor } from '@/lib/subscription-tiers'
import {
  activeFlashSaleForProduct,
  type FlashSaleLike,
} from '@/lib/flash-sales'
import { storePathForHost } from '@/lib/store-links'
import {
  siteUrlFromEnv,
  productTitle,
  productDescription,
  productCanonicalUrl,
  productJsonLd,
  safeJsonLd,
} from '@/lib/seo'
import type { HostKind } from '@/lib/domains'
import type { CSSProperties } from 'react'
import { resolveStoreTheme } from '@/lib/store-themes'

type ProductDetailPageProps = {
  params: Promise<{
    storeSlug: string
    slug: string
  }>
}

// Fase 5 — info host yang melayani (lihat [storeSlug]/page.tsx).
async function getHostInfo(): Promise<{ hostKind: HostKind; hostname: string }> {
  const requestHeaders = await headers()
  const kind = requestHeaders.get('x-cuan-host-kind')
  const hostname = requestHeaders.get('host') ?? ''
  if (kind === 'custom' || kind === 'subdomain') {
    return { hostKind: kind, hostname }
  }
  return { hostKind: 'platform', hostname }
}

// Performa 2026-11-10: getter toko + produk di-cache per request
// supaya generateMetadata dan body berbagi hasil (sebelumnya
// masing-masing menanya ulang secara serial).
const getStoreLite = cache(async (storeSlug: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('stores')
    .select('id, name, slug, theme')
    .eq('slug', storeSlug)
    .maybeSingle()
  return data as {
    id: string
    name: string
    slug: string
    theme: string | null
  } | null
})

const getProductBySlug = cache(async (storeId: string, slug: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    // Daftar kolom eksplisit, BUKAN '*' (P2-12): '*' di PostgREST bisa
    // mengembang ke kolom yang suatu hari dicabut hak SELECT-nya
    // (pelajaran K-03 di stores) sehingga halaman detail 404 total.
    // Kolom di sini = semua yang dipakai halaman + ProductDetailClient.
    .select(
      'id, store_id, name, slug, description, price, stock, available, images, badge, weight_gram'
    )
    .eq('store_id', storeId)
    .eq('slug', slug)
    .maybeSingle()
  return data
})

// Fase 5 — SEO produk: title/description dinamis, canonical sesuai host,
// Open Graph (foto produk pertama).
export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { storeSlug, slug } = await params
  const store = await getStoreLite(storeSlug)
  if (!store) return {}
  const product = await getProductBySlug(store.id, slug)
  if (!product) return {}
  const { hostKind, hostname } = await getHostInfo()
  const siteUrl = siteUrlFromEnv(process.env.NEXT_PUBLIC_SITE_URL)
  const canonical = productCanonicalUrl(product, store, hostKind, hostname, siteUrl)
  const ogImage = (product.images as string[] | null)?.[0] ?? null
  return {
    title: productTitle(product, store.name),
    description: productDescription(product),
    alternates: { canonical },
    openGraph: {
      title: productTitle(product, store.name),
      description: productDescription(product),
      url: canonical,
      type: 'website',
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: { card: 'summary_large_image', title: productTitle(product, store.name), description: productDescription(product) },
  }
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { storeSlug, slug } = await params
  const supabase = await createClient()

  const store = await getStoreLite(storeSlug)
  if (!store) {
    notFound()
  }

  const product = await getProductBySlug(store.id, slug)
  if (!product) {
    notFound()
  }

  // Fase 1 (Bab 5): downgrade menyembunyikan, bukan menghapus — produk di
  // atas batas paket tidak bisa dibuka lewat URL langsung, dan foto ke-2+
  // tidak ditampilkan untuk Free.
  // Performa 2026-11-10: langganan + daftar visibilitas + flash sale
  // independen → satu Promise.all. Daftar visibilitas diambil sampai
  // batas paket TERBESAR (Gold 175) lalu dipotong lokal sesuai paket
  // toko ini — hasilnya identik dengan limit per paket di query.
  const loadFlashSale = async (): Promise<FlashSaleLike | null> => {
    try {
      const { data: flashRows } = await supabase
        .from('flash_sales')
        .select('id, store_id, product_id, promo_price, starts_at, ends_at, is_active')
        .eq('store_id', store.id)
        .eq('product_id', product.id)
        .eq('is_active', true)
      return activeFlashSaleForProduct(
        ((flashRows ?? []) as FlashSaleLike[]).map((s) => ({
          ...s,
          promo_price: Number(s.promo_price),
        })),
        product.id,
        new Date()
      )
    } catch {
      return null
    }
  }
  const [subscription, visibleSlugsResult, flashSale] = await Promise.all([
    getPublicStoreSubscription(store.id),
    supabase
      .from('products')
      .select('slug')
      .eq('store_id', store.id)
      .eq('available', true)
      .order('created_at', { ascending: false })
      .limit(175),
    loadFlashSale(),
  ])
  if (subscription.status === 'SUSPENDED') {
    notFound()
  }
  const tierLimits = limitsFor(subscription)
  const visibleSlugs = (visibleSlugsResult.data ?? []).slice(
    0,
    tierLimits.maxProducts
  )
  const isVisible = visibleSlugs.some((p) => p.slug === slug)
  if (!isVisible) {
    notFound()
  }

  // Fase 5 — JSON-LD Product + tautan "kembali ke toko" yang tetap di
  // host yang melayani (domain custom/subdomain = root, platform = /{slug}).
  const { hostKind, hostname } = await getHostInfo()
  const siteUrl = siteUrlFromEnv(process.env.NEXT_PUBLIC_SITE_URL)
  const canonicalUrl = productCanonicalUrl(
    product,
    store,
    hostKind,
    hostname,
    siteUrl
  )
  const homeHref = storePathForHost(hostKind, store.slug, '/')

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(
            productJsonLd({
              name: product.name,
              slug: product.slug,
              description: product.description,
              price: Number(product.price),
              stock: product.stock,
              available: product.available,
              images: product.images ?? [],
              storeName: store.name,
              canonicalUrl,
            })
          ),
        }}
      />
      <div style={resolveStoreTheme(store.theme).vars as CSSProperties}>
        <ProductDetailClient
          storeSlug={store.slug}
          homeHref={homeHref}
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
      </div>
    </>
  )
}