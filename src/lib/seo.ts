// SEO toko & produk — logika murni (Fase 5).
// Dipakai generateMetadata halaman storefront + produk, sitemap, dan
// robots. Fungsi di file ini murni (tidak menyentuh database) supaya
// gampang dites. URL kanonis memakai host yang sedang melayani bila
// tersedia (domain custom/subdomain), kalau tidak memakai siteUrl.

/** URL situs platform (env NEXT_PUBLIC_SITE_URL, fallback domain live). */
export function siteUrlFromEnv(envValue?: string | null): string {
  const value = (envValue ?? '').trim().replace(/\/+$/, '')
  return value || 'https://jualin-delta.vercel.app'
}

export function truncate(text: string, maxLength: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxLength) return clean
  return `${clean.slice(0, maxLength - 1).trimEnd()}…`
}

export interface StoreSeoInput {
  name: string
  slug: string
  description?: string | null
  city?: string | null
  logoUrl?: string | null
}

export interface ProductSeoInput {
  name: string
  slug: string
  description?: string | null
  price: number
  stock?: number | null
  available?: boolean | null
  images?: string[] | null
}

/** Judul halaman toko: "Nama Toko — CUAN" (maks 60 karakter). */
export function storeTitle(store: StoreSeoInput): string {
  return truncate(`${store.name} — CUAN`, 60)
}

/** Deskripsi toko (maks 160 karakter), fallback kalimat generik. */
export function storeDescription(store: StoreSeoInput): string {
  const raw = store.description?.trim()
  if (raw) return truncate(raw, 160)
  const city = store.city?.trim()
  return truncate(
    `${store.name} — toko online UMKM${city ? ` di ${city}` : ''}. Lihat produk dan pesan langsung, pembayaran ke rekening toko.`,
    160
  )
}

/** Judul halaman produk: "Nama Produk | Nama Toko" (maks 60 karakter). */
export function productTitle(product: ProductSeoInput, storeName: string): string {
  return truncate(`${product.name} | ${storeName}`, 60)
}

/** Deskripsi produk (maks 160 karakter), fallback nama + harga. */
export function productDescription(product: ProductSeoInput): string {
  const raw = product.description?.trim()
  if (raw) return truncate(raw, 160)
  return truncate(
    `${product.name} — Rp ${Number(product.price).toLocaleString('id-ID')}. Pesan langsung dari tokonya.`,
    160
  )
}

/** URL kanonis toko: root host custom/subdomain, atau /{slug} di platform. */
export function storeCanonicalUrl(
  store: StoreSeoInput,
  hostKind: 'platform' | 'custom' | 'subdomain',
  hostname: string,
  siteUrl: string
): string {
  if (hostKind === 'platform') {
    return `${siteUrl.replace(/\/+$/, '')}/${store.slug}`
  }
  return `https://${hostname.replace(/\/+$/, '')}`
}

/** URL kanonis produk (path /products/{slug} di host yang melayani). */
export function productCanonicalUrl(
  product: ProductSeoInput,
  store: StoreSeoInput,
  hostKind: 'platform' | 'custom' | 'subdomain',
  hostname: string,
  siteUrl: string
): string {
  if (hostKind === 'platform') {
    return `${siteUrl.replace(/\/+$/, '')}/${store.slug}/products/${product.slug}`
  }
  return `https://${hostname.replace(/\/+$/, '')}/products/${product.slug}`
}

export interface StoreJsonLdInput extends StoreSeoInput {
  canonicalUrl: string
  logoUrl?: string | null
}

/** JSON-LD Store (schema.org) — nama, deskripsi, logo, URL. */
export function storeJsonLd(input: StoreJsonLdInput): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: input.name,
    description: storeDescription(input),
    url: input.canonicalUrl,
  }
  if (input.logoUrl) jsonLd.logo = input.logoUrl
  if (input.city?.trim()) {
    jsonLd.address = { '@type': 'PostalAddress', addressLocality: input.city.trim() }
  }
  return jsonLd
}

export interface ProductJsonLdInput extends ProductSeoInput {
  canonicalUrl: string
  storeName: string
}

/** JSON-LD Product — harga IDR, stok, ketersediaan. */
export function productJsonLd(input: ProductJsonLdInput): Record<string, unknown> {
  const inStock = input.available !== false && (input.stock ?? 1) > 0
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: productDescription(input),
    url: input.canonicalUrl,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'IDR',
      price: Number(input.price),
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  }
  if (input.images?.[0]) jsonLd.image = input.images[0]
  return jsonLd
}

/** Baris sitemap untuk satu toko (URL kanonisnya). */
export function sitemapStoreUrl(
  store: StoreSeoInput,
  verifiedDomain: string | null,
  siteUrl: string
): string {
  if (verifiedDomain) return `https://${verifiedDomain}`
  return `${siteUrl.replace(/\/+$/, '')}/${store.slug}`
}

/** Baris sitemap untuk satu produk (ikut domain toko bila ada). */
export function sitemapProductUrl(
  product: ProductSeoInput,
  store: StoreSeoInput,
  verifiedDomain: string | null,
  siteUrl: string
): string {
  if (verifiedDomain) {
    return `https://${verifiedDomain}/products/${product.slug}`
  }
  return `${siteUrl.replace(/\/+$/, '')}/${store.slug}/products/${product.slug}`
}
