// Sitemap dinamis (Fase 5) — daftar toko + produk publik.
// URL kanonis per toko: domain custom terverifikasi bila ada, kalau tidak
// path /{slug} di domain platform. Toko SUSPENDED tidak masuk sitemap.
// Bila tabel f5 belum ada, domain custom dilewati (bukan error).
import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { siteUrlFromEnv, sitemapStoreUrl, sitemapProductUrl } from '@/lib/seo'
import {
  TIER_LIMITS,
  limitsFor,
  type SubscriptionRow,
} from '@/lib/subscription-tiers'

type StoreRow = { id: string; slug: string; name: string }
type ProductRow = {
  store_id: string
  slug: string
  updated_at: string | null
}
type DomainRow = { store_id: string; domain: string }

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = siteUrlFromEnv(process.env.NEXT_PUBLIC_SITE_URL)
  const entries: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
  ]

  const admin = createAdminClient()
  const supabase = admin ?? (await createClient())

  const { data: stores } = await supabase
    .from('stores')
    .select('id, slug, name')
    .order('created_at', { ascending: false })
    .limit(500)
  const storeList = (stores ?? []) as StoreRow[]
  if (storeList.length === 0) return entries

  // Domain custom terverifikasi per toko (bila migrasi f5 sudah jalan).
  const verifiedByStore = new Map<string, string>()
  try {
    const { data: domains } = await supabase
      .from('store_domains')
      .select('store_id, domain')
      .eq('status', 'verified')
    for (const d of (domains ?? []) as DomainRow[]) {
      if (!verifiedByStore.has(d.store_id)) {
        verifiedByStore.set(d.store_id, d.domain)
      }
    }
  } catch {
    // Tabel belum ada — sitemap tetap jalan dengan URL platform.
  }

  // P2-04: satu query subscriptions untuk semua toko (bukan N+1
  // getPublicStoreSubscription per toko), lalu filter di memori.
  // Toko tanpa baris langganan = Free; toko SUSPENDED dikeluarkan.
  const subByStore = new Map<string, SubscriptionRow>()
  try {
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('store_id, tier, status, current_period_end')
      .in('store_id', storeList.map((s) => s.id))
    for (const row of (subs ?? []) as Array<
      SubscriptionRow & { store_id: string }
    >) {
      subByStore.set(row.store_id, row)
    }
  } catch {
    // Tabel belum ada — semua toko dianggap Free (bukan error).
  }
  const visibleStores: StoreRow[] = []
  const maxProductsByStore = new Map<string, number>()
  for (const store of storeList) {
    const sub = subByStore.get(store.id)
    if (sub?.status === 'SUSPENDED') continue
    visibleStores.push(store)
    maxProductsByStore.set(
      store.id,
      sub ? limitsFor(sub).maxProducts : TIER_LIMITS.free.maxProducts
    )
  }

  const storeIds = visibleStores.map((s) => s.id)
  const { data: products } = await supabase
    .from('products')
    .select('store_id, slug, updated_at')
    .in('store_id', storeIds)
    .eq('available', true)
    .order('updated_at', { ascending: false })
    .limit(5000)
  const productList = (products ?? []) as ProductRow[]
  const storeById = new Map(visibleStores.map((s) => [s.id, s]))

  // P2-04: terapkan batas produk per tier di sitemap juga — produk di
  // atas batas paket disembunyikan dari storefront, jadi tidak boleh
  // masuk sitemap. Produk diurutkan updated_at desc, jadi N pertama
  // per toko adalah yang terbaru (sama seperti visibleSlugs di halaman
  // detail produk).
  const keptByStore = new Map<string, number>()
  const visibleProducts: ProductRow[] = []
  for (const product of productList) {
    const cap = maxProductsByStore.get(product.store_id)
    if (cap === undefined) continue
    const kept = keptByStore.get(product.store_id) ?? 0
    if (kept >= cap) continue
    keptByStore.set(product.store_id, kept + 1)
    visibleProducts.push(product)
  }

  for (const store of visibleStores) {
    entries.push({
      url: sitemapStoreUrl(store, verifiedByStore.get(store.id) ?? null, siteUrl),
      changeFrequency: 'daily',
      priority: 0.8,
    })
  }
  for (const product of visibleProducts) {
    const store = storeById.get(product.store_id)
    if (!store) continue
    entries.push({
      url: sitemapProductUrl(
        { name: '', slug: product.slug, price: 0 },
        store,
        verifiedByStore.get(store.id) ?? null,
        siteUrl
      ),
      lastModified: product.updated_at ? new Date(product.updated_at) : undefined,
      changeFrequency: 'weekly',
      priority: 0.6,
    })
  }

  return entries
}
