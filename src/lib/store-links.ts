// Tautan toko yang sadar-host (Fase 5).
// Di domain platform, toko tinggal di /{slug} — semua tautan memakai
// prefix itu. Di domain custom / subdomain platform, toko sudah di root
// host itu, jadi tautan produk cukup path-nya saja (tanpa /{slug}).
// Tanpa ini, sekali klik produk di domain sendiri, pengunjung langsung
// terlempar balik ke domain platform.
//
// Server Component: baca host dari headers() lalu pakai
// storePathForHost(). Client Component: pakai storeHref() — membaca
// window.location saat render di browser (SSR fallback = path platform).

import { normalizeDomain } from '@/lib/domains'
import type { HostKind } from '@/lib/domains'

/** Host platform = landing + dashboard + path /{slug}. */
export function isPlatformHost(
  hostname: string,
  platformHosts: string[]
): boolean {
  const host = normalizeDomain(hostname)
  return (
    platformHosts.includes(host) ||
    host.endsWith('.vercel.app') ||
    host === 'localhost' ||
    host === '127.0.0.1'
  )
}

/**
 * Path toko untuk host tertentu.
 * - platform → `/{slug}{path}` (mis. /kopisore/products/kopi)
 * - custom/subdomain → `{path}` saja (mis. /products/kopi)
 */
export function storePathForHost(
  hostKind: HostKind,
  slug: string,
  path: string
): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  if (hostKind === 'platform') return `/${slug}${cleanPath}`
  return cleanPath
}

/** URL absolut toko untuk host tertentu (dipakai canonical/OG). */
export function storeUrlForHost(
  hostKind: HostKind,
  hostname: string,
  slug: string,
  path: string,
  siteUrl: string
): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  if (hostKind === 'platform') {
    return `${siteUrl.replace(/\/+$/, '')}/${slug}${cleanPath}`
  }
  return `https://${normalizeDomain(hostname)}${cleanPath}`
}

/** Versi client-side: host dibaca dari window (saat ini di browser). */
export function storeHref(
  slug: string,
  path: string,
  platformHosts: string[]
): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  if (typeof window === 'undefined') return `/${slug}${cleanPath}`
  const host = normalizeDomain(window.location.hostname)
  if (isPlatformHost(host, platformHosts)) return `/${slug}${cleanPath}`
  return cleanPath
}
