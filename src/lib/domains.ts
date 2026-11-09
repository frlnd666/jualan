// Domain toko — logika murni (Fase 5).
// Dipakai middleware (resolusi hostname), halaman /dashboard/domains
// (validasi + instruksi DNS), dan sitemap. Fungsi di file ini murni
// (tidak menyentuh database) supaya gampang dites.
//
// Aturan:
// - Domain platform: env NEXT_PUBLIC_PLATFORM_DOMAIN (cuan.is-a.web.id).
//   Bila belum diset, platform hanya di jualin-delta.vercel.app dan
//   host *.vercel.app (preview) + localhost.
// - Custom domain = hostname apa pun yang bukan platform dan bukan
//   subdomain platform — di-resolve lewat tabel store_domains
//   (hanya yang status 'verified' yang dilayani).
// - Subdomain platform = {slug}.domain-platform — slug diturunkan dari
//   label pertama, harus slug toko yang valid (lihat store-slug.ts).

import { SLUG_PATTERN, RESERVED_STORE_SLUGS } from '@/lib/store-slug'

/** Domain platform bawaan (live saat ini). */
export const DEFAULT_PLATFORM_DOMAIN = 'cuan.is-a.web.id'

/** Maksimal domain custom per toko (batas server action, bukan CHECK). */
export const MAX_DOMAINS_PER_STORE = 5

/** Domain platform dari env (bila Ferlan sudah punya domain sendiri). */
export function platformDomainFromEnv(envValue?: string | null): string | null {
  const value = (envValue ?? '').trim().toLowerCase()
  if (!value) return null
  return normalizeDomain(value)
}

/** Semua hostname yang dianggap "platform" (landing + dashboard). */
export function platformHosts(platformDomain: string | null): string[] {
  const hosts = [
    DEFAULT_PLATFORM_DOMAIN,
    'jualin-delta.vercel.app',
    'localhost',
    '127.0.0.1',
  ]
  if (platformDomain && !hosts.includes(platformDomain)) {
    hosts.push(platformDomain)
  }
  return hosts
}

/** Buang protokol, path, port, dan spasi — sisakan hostname saja. */
export function normalizeDomain(raw: string): string {
  let value = raw.trim().toLowerCase()
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
  value = value.split('/')[0] ?? ''
  value = value.split(':')[0] ?? ''
  value = value.replace(/\.+$/, '')
  return value
}

const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/** Kembalikan pesan error Bahasa Indonesia, atau null bila domain valid. */
export function validateDomain(raw: string): string | null {
  const domain = normalizeDomain(raw)
  if (!domain) return 'Domain wajib diisi.'
  if (domain.length > 253) return 'Domain terlalu panjang (maks 253 karakter).'
  if (domain.startsWith('www.')) {
    return 'Tulis domain tanpa awalan www. — www ikut aktif otomatis bila DNS-nya benar.'
  }
  const labels = domain.split('.')
  if (labels.length < 2) return 'Domain harus punya TLD (mis. tokoku.com).'
  for (const label of labels) {
    if (!DOMAIN_LABEL.test(label)) {
      return 'Domain hanya boleh huruf, angka, dan tanda hubung (tidak di awal/akhir label).'
    }
  }
  const tld = labels[labels.length - 1] ?? ''
  if (tld.length < 2 || /^\d+$/.test(tld)) {
    return 'TLD domain tidak valid.'
  }
  if (platformHosts(null).includes(domain)) {
    return 'Domain ini dipakai platform dan tidak bisa dipasang sebagai domain toko.'
  }
  return null
}

/** True bila domain adalah apex (tanpa subdomain), mis. tokoku.com. */
export function isApexDomain(domain: string): boolean {
  return normalizeDomain(domain).split('.').length === 2
}

export type HostKind = 'platform' | 'subdomain' | 'custom'

export interface ClassifiedHost {
  kind: HostKind
  /** Slug toko — hanya untuk kind 'subdomain'. */
  slug: string | null
  /** Domain custom apa adanya — hanya untuk kind 'custom'. */
  domain: string | null
}

/**
 * Klasifikasikan hostname mentah (tanpa port) menjadi platform /
 * subdomain-platform / custom. TIDAK menyentuh database — custom domain
 * masih harus di-resolve ke slug lewat tabel store_domains (middleware).
 */
export function classifyHostname(
  rawHost: string,
  platformDomain: string | null
): ClassifiedHost {
  const host = normalizeDomain(rawHost)
  if (!host) return { kind: 'platform', slug: null, domain: null }

  if (
    platformHosts(platformDomain).includes(host) ||
    host === 'localhost' ||
    host.endsWith('.vercel.app')
  ) {
    return { kind: 'platform', slug: null, domain: null }
  }

  if (platformDomain && host.endsWith(`.${platformDomain}`)) {
    const slug = host.slice(0, host.length - platformDomain.length - 1)
    // Hanya satu label dan harus slug toko yang valid — bila tidak,
    // perlakukan sebagai host tak dikenal (bukan subdomain toko).
    if (
      slug &&
      !slug.includes('.') &&
      SLUG_PATTERN.test(slug) &&
      !RESERVED_STORE_SLUGS.has(slug)
    ) {
      return { kind: 'subdomain', slug, domain: null }
    }
    return { kind: 'custom', slug: null, domain: host }
  }

  return { kind: 'custom', slug: null, domain: host }
}

export interface DnsRecord {
  type: 'A' | 'CNAME'
  /** Nama record di DNS (''/@ = apex). */
  name: string
  value: string
  note: string
}

/**
 * Instruksi DNS yang harus dipasang penjual di registrar-nya.
 * Mengikuti panduan Vercel: apex → A ke 76.76.21.21; subdomain → CNAME
 * ke cname.vercel-dns.com. Bila `cnameTarget` diisi (dari Vercel Domains
 * API /v6/domains/{domain}/config), pakai itu — Vercel kadang memberi
 * CNAME khusus proyek, bukan yang generik.
 */
export function dnsInstructionsFor(
  domain: string,
  cnameTarget?: string | null
): DnsRecord[] {
  const normalized = normalizeDomain(domain)
  const cname = cnameTarget?.trim() || 'cname.vercel-dns.com'
  if (isApexDomain(normalized)) {
    return [
      {
        type: 'A',
        name: '@',
        value: '76.76.21.21',
        note: 'Arahkan domain utama ke Vercel.',
      },
      {
        type: 'CNAME',
        name: 'www',
        value: cname,
        note: 'Supaya www.tokomu juga aktif (opsional tapi disarankan).',
      },
    ]
  }
  const firstDot = normalized.indexOf('.')
  const sub = firstDot > 0 ? normalized.slice(0, firstDot) : normalized
  return [
    {
      type: 'CNAME',
      name: sub,
      value: cname,
      note: 'Arahkan subdomain ke Vercel.',
    },
  ]
}

/** URL subdomain toko di domain platform (bila domain platform diset). */
export function subdomainUrl(
  slug: string,
  platformDomain: string | null
): string | null {
  if (!platformDomain) return null
  return `https://${slug}.${platformDomain}`
}

/** URL path toko di domain platform (fallback bila tanpa domain sendiri). */
export function platformStoreUrl(slug: string, siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/${slug}`
}
