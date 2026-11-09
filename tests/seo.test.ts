import { describe, expect, it } from 'vitest'
import {
  truncate,
  storeTitle,
  storeDescription,
  productTitle,
  productDescription,
  storeCanonicalUrl,
  productCanonicalUrl,
  storeJsonLd,
  productJsonLd,
  sitemapStoreUrl,
  sitemapProductUrl,
  siteUrlFromEnv,
} from '@/lib/seo'

const STORE = {
  name: 'Kopi Sore',
  slug: 'kopi-sore',
  description: 'Kopi susu gula aren asli, diseduh fresh setiap pagi.',
  city: 'Serang',
  logoUrl: 'https://example.com/logo.png',
}
const PRODUCT = {
  name: 'Kopi Susu Gula Aren',
  slug: 'kopi-susu-gula-aren',
  description: 'Kopi susu dengan gula aren asli dan susu segar.',
  price: 18000,
  stock: 12,
  available: true,
  images: ['https://example.com/kopi.jpg'],
}

describe('truncate', () => {
  it('memotong teks panjang dengan elipsis', () => {
    expect(truncate('abcdefghij', 6)).toBe('abcde…')
    expect(truncate('pendek', 10)).toBe('pendek')
  })
})

describe('storeTitle / storeDescription', () => {
  it('judul memakai nama toko + CUAN', () => {
    expect(storeTitle(STORE)).toBe('Kopi Sore — CUAN')
  })

  it('deskripsi memakai deskripsi toko bila ada', () => {
    expect(storeDescription(STORE)).toBe(STORE.description)
  })

  it('deskripsi fallback memakai kota bila deskripsi kosong', () => {
    expect(storeDescription({ ...STORE, description: '' })).toContain('Serang')
  })
})

describe('productTitle / productDescription', () => {
  it('judul produk + nama toko', () => {
    expect(productTitle(PRODUCT, 'Kopi Sore')).toBe('Kopi Susu Gula Aren | Kopi Sore')
  })

  it('deskripsi fallback memakai harga', () => {
    expect(productDescription({ ...PRODUCT, description: '' })).toContain('18.000')
  })
})

describe('canonical URL', () => {
  it('platform memakai /{slug}', () => {
    expect(
      storeCanonicalUrl(STORE, 'platform', 'jualin-delta.vercel.app', 'https://jualin-delta.vercel.app')
    ).toBe('https://jualin-delta.vercel.app/kopi-sore')
    expect(
      productCanonicalUrl(PRODUCT, STORE, 'platform', 'jualin-delta.vercel.app', 'https://jualin-delta.vercel.app')
    ).toBe('https://jualin-delta.vercel.app/kopi-sore/products/kopi-susu-gula-aren')
  })

  it('custom/subdomain memakai host itu sendiri', () => {
    expect(storeCanonicalUrl(STORE, 'custom', 'tokoku.com', 'https://jualin-delta.vercel.app')).toBe(
      'https://tokoku.com'
    )
    expect(
      productCanonicalUrl(PRODUCT, STORE, 'subdomain', 'kopi-sore.cuan.id', 'https://jualin-delta.vercel.app')
    ).toBe('https://kopi-sore.cuan.id/products/kopi-susu-gula-aren')
  })
})

describe('JSON-LD', () => {
  it('Store membawa nama, deskripsi, URL, logo, dan kota', () => {
    const jsonLd = storeJsonLd({ ...STORE, canonicalUrl: 'https://tokoku.com' })
    expect(jsonLd['@type']).toBe('Store')
    expect(jsonLd.name).toBe('Kopi Sore')
    expect(jsonLd.url).toBe('https://tokoku.com')
    expect(jsonLd.logo).toBe('https://example.com/logo.png')
  })

  it('Product membawa harga IDR dan stok', () => {
    const jsonLd = productJsonLd({
      ...PRODUCT,
      storeName: 'Kopi Sore',
      canonicalUrl: 'https://tokoku.com/products/kopi-susu-gula-aren',
    })
    expect(jsonLd['@type']).toBe('Product')
    const offers = jsonLd.offers as Record<string, unknown>
    expect(offers.priceCurrency).toBe('IDR')
    expect(offers.price).toBe(18000)
    expect(offers.availability).toBe('https://schema.org/InStock')
    expect(jsonLd.image).toBe('https://example.com/kopi.jpg')
  })

  it('stok habis = OutOfStock', () => {
    const jsonLd = productJsonLd({
      ...PRODUCT,
      stock: 0,
      storeName: 'Kopi Sore',
      canonicalUrl: 'https://tokoku.com/products/kopi-susu-gula-aren',
    })
    const offers = jsonLd.offers as Record<string, unknown>
    expect(offers.availability).toBe('https://schema.org/OutOfStock')
  })
})

describe('sitemap URL', () => {
  it('toko dengan domain terverifikasi memakai domain itu', () => {
    expect(sitemapStoreUrl(STORE, 'tokoku.com', 'https://jualin-delta.vercel.app')).toBe(
      'https://tokoku.com'
    )
    expect(
      sitemapProductUrl(PRODUCT, STORE, 'tokoku.com', 'https://jualin-delta.vercel.app')
    ).toBe('https://tokoku.com/products/kopi-susu-gula-aren')
  })

  it('tanpa domain memakai path platform', () => {
    expect(sitemapStoreUrl(STORE, null, 'https://jualin-delta.vercel.app')).toBe(
      'https://jualin-delta.vercel.app/kopi-sore'
    )
  })
})

describe('siteUrlFromEnv', () => {
  it('fallback ke domain live bila env kosong', () => {
    expect(siteUrlFromEnv('')).toBe('https://cuan.is-a.web.id')
    expect(siteUrlFromEnv('https://cuan.id/')).toBe('https://cuan.id')
  })
})
