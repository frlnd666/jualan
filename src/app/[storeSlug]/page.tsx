import type { Metadata } from 'next'
import { cache, Suspense, type CSSProperties } from 'react'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import StoreCartButton from '@/components/storefront/StoreCartButton'
import StoreChatWidget from '@/components/storefront/StoreChatWidget'
import WatermarkedImage from '@/components/storefront/WatermarkedImage'
import AffiliateAdSlide from '@/components/storefront/AffiliateAdSlide'
import StorefrontToolbar from '@/components/storefront/StorefrontToolbar'
import QuickAddButton from '@/components/storefront/QuickAddButton'
import ShareButton from '@/components/storefront/ShareButton'
import { productShareText } from '@/lib/share'
import { getPublicStoreSubscription } from '@/lib/subscriptions-server'
import { limitsFor } from '@/lib/subscription-tiers'
import { storePathForHost, storeUrlForHost } from '@/lib/store-links'
import {
  siteUrlFromEnv,
  storeTitle,
  storeDescription,
  storeCanonicalUrl,
  storeJsonLd,
  safeJsonLd,
} from '@/lib/seo'
import type { HostKind } from '@/lib/domains'
import { MapPin, Package, PackageOpen } from 'lucide-react'
import { resolveStoreTheme } from '@/lib/store-themes'
import {
  activeFlashSaleForProduct,
  discountPercent,
  formatFlashRemaining,
  flashSaleRemainingMs,
  type FlashSaleLike,
} from '@/lib/flash-sales'

type StorefrontPageProps = {
  params: Promise<{
    storeSlug: string
  }>
  searchParams?: Promise<{
    q?: string
    kategori?: string
  }>
}

// Latar pastel kartu produk (ala desain referensi) — diputar per
// indeks supaya grid terlihat hidup tanpa foto tambahan.
const PASTEL_TILES = ['#e9f7ef', '#fdeef3', '#e8f3fd', '#fdf3e3']

// Escape karakter wildcard LIKE/ILIKE di kata kunci pencarian supaya
// "%" atau "_" dari pengguna tidak melebar jadi pola.
function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

// Fase 5 — info host yang melayani halaman ini (middleware menulis
// header x-cuan-host-kind / x-cuan-store-slug saat rewrite dari domain
// custom/subdomain; tanpa header = domain platform biasa).
async function getHostInfo(): Promise<{ hostKind: HostKind; hostname: string }> {
  const requestHeaders = await headers()
  const kind = requestHeaders.get('x-cuan-host-kind')
  const hostname = requestHeaders.get('host') ?? ''
  if (kind === 'custom' || kind === 'subdomain') {
    return { hostKind: kind, hostname }
  }
  return { hostKind: 'platform', hostname }
}

// Performa 2026-11-10: fetch toko di-cache per request (React
// cache()) supaya generateMetadata dan body halaman berbagi SATU
// query — sebelumnya toko yang sama ditanya dua kali serial, dan
// seluruh rantai di bawahnya juga serial (total ±8 round-trip).
const getStoreBySlug = cache(async (storeSlug: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('stores')
    // Daftar kolom eksplisit, BUKAN '*' (K-03): setelah migrasi hak
    // SELECT tingkat kolom, '*' di PostgREST bisa mengembang ke kolom
    // yang sudah dicabut (cache skema basi) dan seluruh halaman jadi
    // 404. Kolom di sini = semua kolom tampilan publik.
    .select(
      'id, name, slug, description, whatsapp, city, address, instagram, theme, logo_url, banner_url'
    )
    .eq('slug', storeSlug)
    .maybeSingle()
  return data as {
    id: string
    name: string
    slug: string
    description: string | null
    whatsapp: string | null
    city: string | null
    address: string | null
    instagram: string | null
    theme: string | null
    logo_url: string | null
    banner_url: string | null
  } | null
})

// Fase 5 — SEO toko: title/description dinamis, canonical sesuai host,
// Open Graph (logo toko / foto produk pertama).
export async function generateMetadata({
  params,
}: StorefrontPageProps): Promise<Metadata> {
  const { storeSlug } = await params
  const store = await getStoreBySlug(storeSlug)
  if (!store) return {}
  const supabase = await createClient()
  const { hostKind, hostname } = await getHostInfo()
  const siteUrl = siteUrlFromEnv(process.env.NEXT_PUBLIC_SITE_URL)
  const canonical = storeCanonicalUrl(store, hostKind, hostname, siteUrl)
  const { data: firstProduct } = await supabase
    .from('products')
    .select('images')
    .eq('store_id', store.id)
    .eq('available', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const ogImage =
    store.logo_url ??
    ((firstProduct as { images?: string[] | null } | null)?.images?.[0] ?? null)
  return {
    title: storeTitle(store),
    description: storeDescription(store),
    alternates: { canonical },
    openGraph: {
      title: storeTitle(store),
      description: storeDescription(store),
      url: canonical,
      type: 'website',
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: { card: 'summary_large_image', title: storeTitle(store), description: storeDescription(store) },
  }
}

function formatRupiah(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0)
  if (Number.isNaN(numeric)) return '0'
  return numeric.toLocaleString('id-ID')
}

function getCategoryName(
  product: { category_id?: string | null },
  categoryNames: Map<string, string>
): string | null {
  if (!product.category_id) return null
  return categoryNames.get(product.category_id) ?? null
}

type StoreBannerLike = {
  title: string
  image_url: string | null
  link_url: string | null
}

// Fase 4 — banner marketing aktif toko (Silver/Gold). Helper terpisah
// agar TypeScript tidak mempersempit `activeBanner` jadi `never`
// (penugasan di dalam try/catch kondisional tidak terbaca CFA).
// Gagal/migrasi belum jalan = tanpa banner.
async function loadActiveBanner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string
): Promise<StoreBannerLike | null> {
  try {
    const { data: bannerRow } = await supabase
      .from('store_banners')
      .select('title, image_url, link_url')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const row = bannerRow as StoreBannerLike | null
    if (!row) return null
    return {
      title: String(row.title ?? ''),
      image_url: row.image_url ?? null,
      link_url: row.link_url ?? null,
    }
  } catch {
    return null
  }
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

// Kategori toko untuk chip filter di toolbar. Gagal/migrasi belum
// jalan = tanpa chip (toko tetap tampil normal).
async function loadStoreCategories(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string
): Promise<Array<{ id: string; name: string }>> {
  try {
    const { data } = await supabase
      .from('product_categories')
      .select('id, name')
      .eq('store_id', storeId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    return ((data ?? []) as Array<{ id?: string; name?: string }>)
      .filter((c) => c?.id && c?.name)
      .map((c) => ({ id: c.id as string, name: c.name as string }))
  } catch {
    return []
  }
}

export default async function StorefrontPage({ params, searchParams }: StorefrontPageProps) {
  const { storeSlug } = await params
  const sp = (await searchParams) ?? {}
  const rawQuery = typeof sp.q === 'string' ? sp.q.trim().slice(0, 100) : ''
  const rawCategory = typeof sp.kategori === 'string' ? sp.kategori.trim() : ''
  const supabase = await createClient()
  const { hostKind, hostname } = await getHostInfo()
  const siteUrl = siteUrlFromEnv(process.env.NEXT_PUBLIC_SITE_URL)
  // Fase 5 — tautan produk tetap di host yang melayani (domain custom/
  // subdomain = path tanpa /{slug}; platform = /{slug}/products/...).
  const productHref = (productSlug: string) =>
    storePathForHost(hostKind, storeSlug, `/products/${productSlug}`)
  const canonicalUrl = storeUrlForHost(hostKind, hostname, storeSlug, '/', siteUrl)
  const storePath = storePathForHost(hostKind, storeSlug, '/')

  const store = await getStoreBySlug(storeSlug)
  if (!store) {
    notFound()
  }

  // Langganan + kategori hanya bergantung pada store.id → paralel.
  // Kategori dimuat dulu supaya nilai ?kategori= bisa divalidasi
  // terhadap kategori toko ini (nilai asing diabaikan, bukan error).
  const [subscription, storeCategories] = await Promise.all([
    getPublicStoreSubscription(store.id),
    loadStoreCategories(supabase, store.id),
  ])
  const activeCategory =
    storeCategories.find((c) => c.id === rawCategory) ?? null

  // Produk difilter di server (sebelum pemotongan batas paket) —
  // pencarian (?q=) dan kategori (?kategori=).
  let productsQuery = supabase
    .from('products')
    .select('id, name, slug, price, stock, images, badge, description, category_id, weight_gram')
    .eq('store_id', store.id)
    .eq('available', true)
  if (rawQuery) {
    productsQuery = productsQuery.ilike('name', `%${escapeIlike(rawQuery)}%`)
  }
  if (activeCategory) {
    productsQuery = productsQuery.eq('category_id', activeCategory.id)
  }
  const { data: products } = await productsQuery.order('created_at', {
    ascending: false,
  })

  // Fase 1 (Bab 5): downgrade menyembunyikan, bukan menghapus.
  // - Toko SUSPENDED hilang dari publik.
  // - Produk di atas batas paket tidak ditampilkan (diurutkan terbaru
  //   dulu, jadi yang tampil adalah produk terbaru sampai batas).
  // - Foto ke-2+ tidak ditampilkan untuk Free (max 1 foto).
  // Fase 4: foto Free tampil dengan watermark platform (overlay display,
  // file asli utuh) + banner Free menampilkan 1 slide iklan afiliasi.
  if (subscription.status === 'SUSPENDED') {
    notFound()
  }
  const tierLimits = limitsFor(subscription)
  const visibleProducts = (products ?? [])
    .slice(0, tierLimits.maxProducts)
    .map((p) => ({
      ...p,
      images: (p.images ?? []).slice(0, tierLimits.maxPhotosPerProduct),
    }))

  // Fase 4 — flash sale aktif toko ini (policy publik hanya membaca
  // yang aktif + di dalam jadwal). Bila tabel belum ada (migrasi f4
  // belum dijalankan), abaikan — harga normal yang tampil.
  // Flash sale + banner sama-sama hanya butuh store.id → paralel.
  const now = new Date()
  const loadFlashSales = async (): Promise<FlashSaleLike[]> => {
    try {
      const { data: flashRows } = await supabase
        .from('flash_sales')
        .select('id, store_id, product_id, promo_price, starts_at, ends_at, is_active')
        .eq('store_id', store.id)
        .eq('is_active', true)
      return ((flashRows ?? []) as FlashSaleLike[]).map((s) => ({
        ...s,
        promo_price: Number(s.promo_price),
      }))
    } catch {
      return []
    }
  }
  // Fase 4 — banner marketing aktif toko (Silver/Gold). Toko Free tidak
  // punya banner sendiri; sebagai gantinya tampil slide iklan afiliasi.
  const [flashSales, activeBanner] = await Promise.all([
    loadFlashSales(),
    !tierLimits.affiliateAds
      ? loadActiveBanner(supabase, store.id)
      : Promise.resolve(null),
  ])
  const pricedProducts = visibleProducts.map((p) => {
    const sale = activeFlashSaleForProduct(flashSales, p.id, now)
    const normalPrice = Number(p.price)
    const hasFlash = sale !== null && Number(sale.promo_price) < normalPrice
    return {
      ...p,
      flashSale: hasFlash ? sale : null,
      displayPrice: hasFlash ? Number(sale!.promo_price) : normalPrice,
    }
  })

  // Nama kategori dari daftar kategori toko yang sudah dimuat (tanpa
  // query tambahan).
  const categoryNames = new Map<string, string>(
    storeCategories.map((c) => [c.id, c.name])
  )
  const isFiltering = rawQuery !== '' || activeCategory !== null

  const productList = pricedProducts
  const totalProducts = productList.length
  const featuredProducts = productList.slice(0, 2)

  // Tema toko (lib/store-themes.ts): override CSS variable di
  // pembungkus — pilihan tema seller akhirnya benar-benar diterapkan.
  const theme = resolveStoreTheme(
    (store as { theme?: string | null }).theme
  )

  return (
    <div
      className="min-h-screen bg-[var(--bg)] pb-24 text-[var(--text)]"
      style={theme.vars as CSSProperties}
    >
      {/* Fase 5 — JSON-LD Store untuk mesin pencari. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(
            storeJsonLd({
              name: store.name,
              slug: store.slug,
              description: store.description,
              city: store.city,
              logoUrl: store.logo_url,
              canonicalUrl,
            })
          ),
        }}
      />
      <div className="mx-auto max-w-4xl">
        <section className="relative overflow-hidden bg-[var(--text)] text-white">
          {store.banner_url ? (
            <>
              <img
                src={store.banner_url}
                alt={store.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/45 to-[var(--text)]/95" />
            </>
          ) : (
            <>
              <div
                className="absolute inset-0"
                style={{ background: theme.heroBackground }}
              />
              <div className="absolute right-[-40px] top-[-10px] h-40 w-40 rounded-full bg-[var(--surface)]/10 blur-3xl" />
              <div className="absolute bottom-[-50px] left-[-30px] h-44 w-44 rounded-full bg-amber-300/10 blur-3xl" />
            </>
          )}

          <div className="relative px-4 pb-8 pt-6 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[var(--surface)]/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/80 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Toko buka
              </div>

              <StoreCartButton />
            </div>

            <div className="mt-10 flex items-end gap-4">
              {store.logo_url ? (
                <img
                  src={store.logo_url}
                  alt={store.name}
                  className="h-16 w-16 rounded-[22px] border border-white/15 object-cover shadow-lg"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/15 bg-[var(--surface)]/10 text-lg font-bold text-white shadow-lg backdrop-blur">
                  {getInitials(store.name)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/60">
                  Storefront
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
                  {store.name}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
                  {store.description?.trim() || 'Produk pilihan yang disiapkan rapi, cepat, dan siap dipesan.'}
                </p>
                {(store.city || store.instagram) ? (
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/70">
                    {store.city ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" aria-hidden /> {store.city}
                      </span>
                    ) : null}
                    {store.instagram ? (
                      <a
                        href={`https://instagram.com/${String(store.instagram).replace(/^@/, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-white/85 underline decoration-white/30 underline-offset-2 hover:text-white"
                      >
                        @{String(store.instagram).replace(/^@/, '')}
                      </a>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-[var(--surface)]/10 px-3 py-3 backdrop-blur">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/55">
                  Produk
                </p>
                <p className="mt-1 text-lg font-bold text-white">{totalProducts}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[var(--surface)]/10 px-3 py-3 backdrop-blur">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/55">
                  Highlight
                </p>
                <p className="mt-1 text-lg font-bold text-white">
                  {featuredProducts.length}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[var(--surface)]/10 px-3 py-3 backdrop-blur">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/55">
                  Siap order
                </p>
                <p className="mt-1 text-lg font-bold text-white">Hari ini</p>
              </div>
            </div>
          </div>
        </section>

        <main className="px-4 pb-8 pt-5 sm:px-6">
          {/* Toolbar ala desain referensi: pencarian + chip kategori +
              bagikan toko. useSearchParams di dalamnya butuh Suspense. */}
          <Suspense>
            <StorefrontToolbar
              categories={storeCategories}
              activeCategoryId={activeCategory?.id ?? null}
              initialQuery={rawQuery}
              storeName={store.name}
              storeDescription={store.description}
              storePath={storePath}
            />
          </Suspense>

          {/* Fase 4 — banner marketing toko (Silver/Gold) atau 1 slide
              iklan afiliasi berlabel "Iklan" (Free). */}
          {activeBanner ? (
            <section className="mb-6 overflow-hidden rounded-[28px] border border-black/5 bg-[var(--surface)] shadow-[0_12px_30px_rgba(33,24,20,0.06)]">
              {activeBanner.image_url ? (
                <img
                  src={activeBanner.image_url}
                  alt={activeBanner.title}
                  className="h-36 w-full object-cover"
                />
              ) : null}
              <div className="p-4">
                <p className="text-base font-bold text-[var(--text)]">
                  {activeBanner.title}
                </p>
                {activeBanner.link_url ? (
                  <Link
                    href={activeBanner.link_url}
                    className="mt-2 inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white"
                  >
                    Lihat selengkapnya
                  </Link>
                ) : null}
              </div>
            </section>
          ) : tierLimits.affiliateAds ? (
            <div className="mb-6">
              <AffiliateAdSlide />
            </div>
          ) : null}

          {featuredProducts.length > 0 && !isFiltering ? (
            <section className="mb-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Pilihan
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-[var(--text)]">
                    Rekomendasi toko
                  </h2>
                </div>
              </div>

              <div className="grid gap-3">
                {featuredProducts.map((product) => (
                  <Link
                    key={`featured-${product.id}`}
                    href={productHref(product.slug)}
                    className="overflow-hidden rounded-[28px] border border-black/5 bg-[var(--surface)] shadow-[0_12px_30px_rgba(33,24,20,0.06)] transition hover:-translate-y-0.5"
                  >
                    <div className="grid grid-cols-[112px_1fr]">
                      <div className="relative h-full min-h-[112px] bg-[var(--surface-muted)]">
                        {product.images?.[0] ? (
                          <WatermarkedImage
                            src={product.images[0]}
                            alt={product.name}
                            watermarked={tierLimits.watermark}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[var(--surface-soft)]">
                            <Package className="h-8 w-8 text-[var(--text-muted)]" aria-hidden />
                          </div>
                        )}

                        {product.badge ? (
                          <span className="absolute left-2 top-2 rounded-full bg-[var(--text)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                            {product.badge}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex min-w-0 flex-col justify-between p-4">
                        <div>
                          <p className="line-clamp-1 text-base font-bold text-[var(--text)]">
                            {product.name}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--text-muted)]">
                            {product.description?.trim() || 'Menu pilihan dengan rasa yang dibuat untuk dinikmati kapan saja.'}
                          </p>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div>
                            {product.flashSale ? (
                              <p className="text-xs font-medium text-[var(--text-muted)] line-through">
                                Rp {formatRupiah(product.price)}
                              </p>
                            ) : null}
                            <p className="text-sm font-bold text-[var(--primary)]">
                              Rp {formatRupiah(product.displayPrice)}
                            </p>
                            {product.flashSale ? (
                              <p className="mt-0.5 text-[11px] font-bold text-red-600">
                                FLASH SALE −{discountPercent(product.price, product.displayPrice)}% •{' '}
                                {formatFlashRemaining(
                                  flashSaleRemainingMs(product.flashSale, now)
                                )}
                              </p>
                            ) : null}
                          </div>
                          <span className="inline-flex items-center justify-center rounded-full bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--text)]">
                            Lihat
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {isFiltering ? 'Hasil' : 'Menu'}
                </p>
                <h2 className="mt-1 text-lg font-bold text-[var(--text)]">
                  {rawQuery
                    ? `Cari "${rawQuery}"`
                    : activeCategory
                      ? activeCategory.name
                      : 'Semua produk'}
                </h2>
              </div>

              <p className="text-xs font-medium text-[var(--text-muted)]">
                {totalProducts} item
              </p>
            </div>

            {productList.length === 0 ? (
              <div className="rounded-[32px] border border-dashed border-[var(--line)] bg-[var(--surface)] px-6 py-10 text-center shadow-[var(--shadow-sm)]">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-soft)]">
                  <PackageOpen className="h-8 w-8 text-[var(--text-muted)]" aria-hidden />
                </div>
                <p className="mt-4 text-base font-bold text-[var(--text)]">
                  {isFiltering
                    ? 'Tidak ada produk yang cocok'
                    : 'Belum ada produk tersedia'}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  {isFiltering
                    ? 'Coba kata kunci lain atau pilih kategori Semua.'
                    : 'Toko ini belum menampilkan produk yang siap dipesan saat ini.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {productList.map((product, index) => (
                  <article
                    key={product.id}
                    className="group overflow-hidden rounded-[28px] border border-black/5 bg-[var(--surface)] shadow-[0_12px_30px_rgba(33,24,20,0.06)] transition hover:-translate-y-0.5"
                  >
                    <div
                      className="relative aspect-[4/5] overflow-hidden"
                      style={{ background: PASTEL_TILES[index % PASTEL_TILES.length] }}
                    >
                      {/* Foto dibuat inset (padding) supaya latar pastel
                          terlihat membingkai foto — sebelumnya foto
                          full-bleed menutupi pastel sepenuhnya. */}
                      <Link
                        href={productHref(product.slug)}
                        aria-label={product.name}
                        className="absolute inset-0 p-3"
                      >
                        {product.images?.[0] ? (
                          <WatermarkedImage
                            src={product.images[0]}
                            alt={product.name}
                            watermarked={tierLimits.watermark}
                            className="h-full w-full rounded-[20px] object-cover shadow-sm transition duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center rounded-[20px] bg-white/60 px-4 text-center">
                            <Package className="h-9 w-9 text-[var(--text-muted)]" aria-hidden />
                            <span className="mt-3 text-xs font-medium text-[var(--text-muted)]">
                              Foto segera hadir
                            </span>
                          </div>
                        )}
                      </Link>

                      {product.badge ? (
                        <span className="absolute left-3 top-3 rounded-full bg-[var(--text)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white shadow-sm">
                          {product.badge}
                        </span>
                      ) : null}

                      <ShareButton
                        path={productHref(product.slug)}
                        title={product.name}
                        text={productShareText(product.name, product.displayPrice)}
                        label="Bagikan"
                        className="absolute right-2.5 top-2.5 z-10 px-2.5 py-1.5"
                      />
                    </div>

                    <div className="p-3.5">
                      {getCategoryName(product, categoryNames) ? (
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                          {getCategoryName(product, categoryNames)}
                        </p>
                      ) : null}
                      <Link href={productHref(product.slug)}>
                        <p className="line-clamp-2 min-h-[2.75rem] text-sm font-bold leading-5 text-[var(--text)]">
                          {product.name}
                        </p>
                      </Link>
                      <div className="mt-2 flex items-end justify-between gap-2">
                        <div className="min-w-0">
                          {product.flashSale ? (
                            <p className="text-[11px] font-medium text-[var(--text-muted)] line-through">
                              Rp {formatRupiah(product.price)}
                            </p>
                          ) : null}
                          <p className="truncate text-sm font-bold text-[var(--primary)]">
                            Rp {formatRupiah(product.displayPrice)}
                          </p>
                          {product.flashSale ? (
                            <p className="mt-0.5 text-[10px] font-bold text-red-600">
                              FLASH SALE −{discountPercent(product.price, product.displayPrice)}%
                            </p>
                          ) : null}
                        </div>
                        <QuickAddButton
                          product={{ ...product, store_id: store.id }}
                          storeSlug={store.slug}
                        />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      <StoreChatWidget storeId={store.id} storeName={store.name} />
    </div>
  )
}