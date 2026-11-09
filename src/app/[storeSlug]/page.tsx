import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import StoreCartButton from '@/components/storefront/StoreCartButton'
import StoreChatWidget from '@/components/storefront/StoreChatWidget'
import WatermarkedImage from '@/components/storefront/WatermarkedImage'
import AffiliateAdSlide from '@/components/storefront/AffiliateAdSlide'
import { getPublicStoreSubscription } from '@/lib/subscriptions-server'
import { limitsFor } from '@/lib/subscription-tiers'
import { storePathForHost, storeUrlForHost } from '@/lib/store-links'
import {
  siteUrlFromEnv,
  storeTitle,
  storeDescription,
  storeCanonicalUrl,
  storeJsonLd,
} from '@/lib/seo'
import type { HostKind } from '@/lib/domains'
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

// Fase 5 — SEO toko: title/description dinamis, canonical sesuai host,
// Open Graph (logo toko / foto produk pertama).
export async function generateMetadata({
  params,
}: StorefrontPageProps): Promise<Metadata> {
  const { storeSlug } = await params
  const supabase = await createClient()
  const { data: store } = await supabase
    .from('stores')
    .select('id, name, slug, description, city, logo_url')
    .eq('slug', storeSlug)
    .maybeSingle()
  if (!store) return {}
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

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const { storeSlug } = await params
  const supabase = await createClient()
  const { hostKind, hostname } = await getHostInfo()
  const siteUrl = siteUrlFromEnv(process.env.NEXT_PUBLIC_SITE_URL)
  // Fase 5 — tautan produk tetap di host yang melayani (domain custom/
  // subdomain = path tanpa /{slug}; platform = /{slug}/products/...).
  const productHref = (productSlug: string) =>
    storePathForHost(hostKind, storeSlug, `/products/${productSlug}`)
  const canonicalUrl = storeUrlForHost(hostKind, hostname, storeSlug, '/', siteUrl)

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('*')
    .eq('slug', storeSlug)
    .maybeSingle()

  if (storeError || !store) {
    notFound()
  }

  const { data: products } = await supabase
    .from('products')
    .select('id, name, slug, price, images, badge, description, category_id, weight_gram')
    .eq('store_id', store.id)
    .eq('available', true)
    .order('created_at', { ascending: false })

  // Fase 1 (Bab 5): downgrade menyembunyikan, bukan menghapus.
  // - Toko SUSPENDED hilang dari publik.
  // - Produk di atas batas paket tidak ditampilkan (diurutkan terbaru
  //   dulu, jadi yang tampil adalah produk terbaru sampai batas).
  // - Foto ke-2+ tidak ditampilkan untuk Free (max 1 foto).
  // Fase 4: foto Free tampil dengan watermark platform (overlay display,
  // file asli utuh) + banner Free menampilkan 1 slide iklan afiliasi.
  const subscription = await getPublicStoreSubscription(store.id)
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
  const now = new Date()
  let flashSales: FlashSaleLike[] = []
  try {
    const { data: flashRows } = await supabase
      .from('flash_sales')
      .select('id, store_id, product_id, promo_price, starts_at, ends_at, is_active')
      .eq('store_id', store.id)
      .eq('is_active', true)
    flashSales = ((flashRows ?? []) as FlashSaleLike[]).map((s) => ({
      ...s,
      promo_price: Number(s.promo_price),
    }))
  } catch {
    flashSales = []
  }
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

  // Fase 4 — banner marketing aktif toko (Silver/Gold). Toko Free tidak
  // punya banner sendiri; sebagai gantinya tampil slide iklan afiliasi.
  const activeBanner: StoreBannerLike | null = !tierLimits.affiliateAds
    ? await loadActiveBanner(supabase, store.id)
    : null

  // Nama kategori diambil dari tabel product_categories (nama tabel asli
  // di database) dengan query terpisah — bukan embed relasi — agar tahan
  // terhadap perbedaan nama relasi PostgREST.
  const categoryIds = Array.from(
    new Set(visibleProducts.map((p) => p.category_id).filter(Boolean))
  ) as string[]

  const categoryNames = new Map<string, string>()
  if (categoryIds.length > 0) {
    const { data: categories } = await supabase
      .from('product_categories')
      .select('id, name')
      .in('id', categoryIds)

    for (const category of categories ?? []) {
      if (category?.id && category?.name) {
        categoryNames.set(category.id, category.name)
      }
    }
  }

  const productList = pricedProducts
  const totalProducts = productList.length
  const featuredProducts = productList.slice(0, 2)

  return (
    <div className="min-h-screen bg-[#f6f1ea] pb-24 text-zinc-900">
      {/* Fase 5 — JSON-LD Store untuk mesin pencari. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
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
        <section className="relative overflow-hidden bg-[#2f241f] text-white">
          {store.banner_url ? (
            <>
              <img
                src={store.banner_url}
                alt={store.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/45 to-[#2f241f]/95" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(255,210,160,0.18),_transparent_24%),linear-gradient(135deg,#4b342b_0%,#2f241f_52%,#211814_100%)]" />
              <div className="absolute right-[-40px] top-[-10px] h-40 w-40 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute bottom-[-50px] left-[-30px] h-44 w-44 rounded-full bg-amber-300/10 blur-3xl" />
            </>
          )}

          <div className="relative px-4 pb-8 pt-6 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/80 backdrop-blur">
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
                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/15 bg-white/10 text-lg font-bold text-white shadow-lg backdrop-blur">
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
                    {store.city ? <span>📍 {store.city}</span> : null}
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
              <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3 backdrop-blur">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/55">
                  Produk
                </p>
                <p className="mt-1 text-lg font-bold text-white">{totalProducts}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3 backdrop-blur">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/55">
                  Highlight
                </p>
                <p className="mt-1 text-lg font-bold text-white">
                  {featuredProducts.length}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3 backdrop-blur">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/55">
                  Siap order
                </p>
                <p className="mt-1 text-lg font-bold text-white">Hari ini</p>
              </div>
            </div>
          </div>
        </section>

        <main className="px-4 pb-8 pt-5 sm:px-6">
          {/* Fase 4 — banner marketing toko (Silver/Gold) atau 1 slide
              iklan afiliasi berlabel "Iklan" (Free). */}
          {activeBanner ? (
            <section className="mb-6 overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_12px_30px_rgba(33,24,20,0.06)]">
              {activeBanner.image_url ? (
                <img
                  src={activeBanner.image_url}
                  alt={activeBanner.title}
                  className="h-36 w-full object-cover"
                />
              ) : null}
              <div className="p-4">
                <p className="text-base font-bold text-[#241b17]">
                  {activeBanner.title}
                </p>
                {activeBanner.link_url ? (
                  <Link
                    href={activeBanner.link_url}
                    className="mt-2 inline-flex items-center justify-center rounded-full bg-[#0b6b4a] px-4 py-2 text-xs font-semibold text-white"
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

          {featuredProducts.length > 0 ? (
            <section className="mb-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8d7f73]">
                    Pilihan
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-[#241b17]">
                    Rekomendasi toko
                  </h2>
                </div>
              </div>

              <div className="grid gap-3">
                {featuredProducts.map((product) => (
                  <Link
                    key={`featured-${product.id}`}
                    href={productHref(product.slug)}
                    className="overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_12px_30px_rgba(33,24,20,0.06)] transition hover:-translate-y-0.5"
                  >
                    <div className="grid grid-cols-[112px_1fr]">
                      <div className="relative h-full min-h-[112px] bg-[#efe6dc]">
                        {product.images?.[0] ? (
                          <WatermarkedImage
                            src={product.images[0]}
                            alt={product.name}
                            watermarked={tierLimits.watermark}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#f3d9bf,_#e7d5c5_45%,_#dbc6b5_100%)]">
                            <span className="text-2xl">☕</span>
                          </div>
                        )}

                        {product.badge ? (
                          <span className="absolute left-2 top-2 rounded-full bg-[#2f241f] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                            {product.badge}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex min-w-0 flex-col justify-between p-4">
                        <div>
                          <p className="line-clamp-1 text-base font-bold text-[#241b17]">
                            {product.name}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#7a6b5f]">
                            {product.description?.trim() || 'Menu pilihan dengan rasa yang dibuat untuk dinikmati kapan saja.'}
                          </p>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div>
                            {product.flashSale ? (
                              <p className="text-xs font-medium text-[#8d7f73] line-through">
                                Rp {formatRupiah(product.price)}
                              </p>
                            ) : null}
                            <p className="text-sm font-bold text-[#5b3df5]">
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
                          <span className="inline-flex items-center justify-center rounded-full bg-[#f3efe9] px-3 py-1.5 text-xs font-semibold text-[#241b17]">
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
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8d7f73]">
                  Menu
                </p>
                <h2 className="mt-1 text-lg font-bold text-[#241b17]">
                  Semua produk
                </h2>
              </div>

              <p className="text-xs font-medium text-[#8d7f73]">
                {totalProducts} item
              </p>
            </div>

            {productList.length === 0 ? (
              <div className="rounded-[32px] border border-dashed border-[#d9cec3] bg-white px-6 py-10 text-center shadow-[0_10px_24px_rgba(33,24,20,0.04)]">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f3eee8] text-2xl">
                  🍽️
                </div>
                <p className="mt-4 text-base font-bold text-[#241b17]">
                  Belum ada produk tersedia
                </p>
                <p className="mt-2 text-sm leading-6 text-[#7a6b5f]">
                  Toko ini belum menampilkan produk yang siap dipesan saat ini.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {productList.map((product) => (
                  <Link
                    key={product.id}
                    href={productHref(product.slug)}
                    className="group overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_12px_30px_rgba(33,24,20,0.06)] transition hover:-translate-y-0.5"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-[#efe7de]">
                      {product.images?.[0] ? (
                        <WatermarkedImage
                          src={product.images[0]}
                          alt={product.name}
                          watermarked={tierLimits.watermark}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top,#f5dfcb,_#eadacc_50%,_#dfccbb_100%)] px-4 text-center">
                          <span className="text-3xl">☕</span>
                          <span className="mt-3 text-xs font-medium text-[#7a6b5f]">
                            Foto segera hadir
                          </span>
                        </div>
                      )}

                      {product.badge ? (
                        <span className="absolute left-3 top-3 rounded-full bg-[#2f241f] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white shadow-sm">
                          {product.badge}
                        </span>
                      ) : null}
                    </div>

                    <div className="p-3.5">
                      {getCategoryName(product, categoryNames) ? (
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8d7f73]">
                          {getCategoryName(product, categoryNames)}
                        </p>
                      ) : null}
                      <p className="line-clamp-2 min-h-[2.75rem] text-sm font-bold leading-5 text-[#241b17]">
                        {product.name}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div>
                          {product.flashSale ? (
                            <p className="text-[11px] font-medium text-[#8d7f73] line-through">
                              Rp {formatRupiah(product.price)}
                            </p>
                          ) : null}
                          <p className="text-sm font-bold text-[#5b3df5]">
                            Rp {formatRupiah(product.displayPrice)}
                          </p>
                          {product.flashSale ? (
                            <p className="mt-0.5 text-[10px] font-bold text-red-600">
                              FLASH SALE −{discountPercent(product.price, product.displayPrice)}%
                            </p>
                          ) : null}
                        </div>
                        <span className="rounded-full bg-[#f4efe9] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6d5f54]">
                          Detail
                        </span>
                      </div>
                    </div>
                  </Link>
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