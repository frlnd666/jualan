import { describe, expect, it } from 'vitest'
import {
  normalizeDomain,
  validateDomain,
  isApexDomain,
  classifyHostname,
  dnsInstructionsFor,
  subdomainUrl,
} from '@/lib/domains'
import {
  isPlatformHost,
  storePathForHost,
  storeUrlForHost,
} from '@/lib/store-links'

const PLATFORM = 'cuan.id'
const PLATFORM_HOSTS = ['jualin-delta.vercel.app', 'cuan.id', 'localhost', '127.0.0.1']

describe('normalizeDomain', () => {
  it('membuang protokol, path, port, dan spasi', () => {
    expect(normalizeDomain('https://TokoKu.COM/')).toBe('tokoku.com')
    expect(normalizeDomain('  tokoku.com:443 ')).toBe('tokoku.com')
    expect(normalizeDomain('tokoku.com.')).toBe('tokoku.com')
  })
})

describe('validateDomain', () => {
  it('menerima domain wajar', () => {
    expect(validateDomain('tokoku.com')).toBeNull()
    expect(validateDomain('toko-ku.co.id')).toBeNull()
    expect(validateDomain('shop.tokoku.com')).toBeNull()
  })

  it('menolak domain tanpa TLD / label tidak valid / www', () => {
    expect(validateDomain('tokoku')).not.toBeNull()
    expect(validateDomain('www.tokoku.com')).not.toBeNull()
    expect(validateDomain('-toko.com')).not.toBeNull()
    expect(validateDomain('toko..com')).not.toBeNull()
    expect(validateDomain('')).not.toBeNull()
  })

  it('menolak domain platform', () => {
    expect(validateDomain('cuan.is-a.web.id')).not.toBeNull()
    expect(validateDomain('jualin-delta.vercel.app')).not.toBeNull()
  })
})

describe('isApexDomain', () => {
  it('apex = tepat 2 label', () => {
    expect(isApexDomain('tokoku.com')).toBe(true)
    expect(isApexDomain('shop.tokoku.com')).toBe(false)
    expect(isApexDomain('toko.co.id')).toBe(false)
  })
})

describe('classifyHostname', () => {
  it('host platform dikenali', () => {
    expect(classifyHostname('jualin-delta.vercel.app', PLATFORM).kind).toBe('platform')
    expect(classifyHostname('cuan.id', PLATFORM).kind).toBe('platform')
    expect(classifyHostname('localhost', PLATFORM).kind).toBe('platform')
    expect(classifyHostname('jualin-abc123.vercel.app', PLATFORM).kind).toBe('platform')
  })

  it('subdomain platform menghasilkan slug', () => {
    const result = classifyHostname('kopi-sore.cuan.id', PLATFORM)
    expect(result.kind).toBe('subdomain')
    expect(result.slug).toBe('kopi-sore')
  })

  it('subdomain dengan slug terlarang/tidak valid jadi custom', () => {
    expect(classifyHostname('login.cuan.id', PLATFORM).kind).toBe('custom')
    expect(classifyHostname('a.b.cuan.id', PLATFORM).kind).toBe('custom')
  })

  it('host lain = custom', () => {
    const result = classifyHostname('tokoku.com', PLATFORM)
    expect(result.kind).toBe('custom')
    expect(result.domain).toBe('tokoku.com')
  })

  it('tanpa domain platform, subdomain tidak dikenali', () => {
    expect(classifyHostname('kopi-sore.cuan.id', null).kind).toBe('custom')
  })
})

describe('dnsInstructionsFor', () => {
  it('apex memakai A + CNAME www', () => {
    const records = dnsInstructionsFor('tokoku.com')
    expect(records[0]).toMatchObject({ type: 'A', name: '@', value: '76.76.21.21' })
    expect(records[1]).toMatchObject({ type: 'CNAME', name: 'www' })
  })

  it('subdomain memakai CNAME saja', () => {
    const records = dnsInstructionsFor('shop.tokoku.com')
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ type: 'CNAME', name: 'shop', value: 'cname.vercel-dns.com' })
  })

  it('CNAME khusus proyek dari Vercel dipakai bila ada', () => {
    const records = dnsInstructionsFor('shop.tokoku.com', 'abc123.vercel-dns-017.com')
    expect(records[0].value).toBe('abc123.vercel-dns-017.com')
  })
})

describe('subdomainUrl', () => {
  it('mengembalikan URL bila domain platform diset', () => {
    expect(subdomainUrl('kopi-sore', 'cuan.id')).toBe('https://kopi-sore.cuan.id')
  })

  it('null bila domain platform belum diset', () => {
    expect(subdomainUrl('kopi-sore', null)).toBeNull()
  })
})

describe('isPlatformHost', () => {
  it('mengenali host platform + preview vercel + localhost', () => {
    expect(isPlatformHost('jualin-delta.vercel.app', PLATFORM_HOSTS)).toBe(true)
    expect(isPlatformHost('jualin-xyz-123.vercel.app', PLATFORM_HOSTS)).toBe(true)
    expect(isPlatformHost('localhost:3000', PLATFORM_HOSTS)).toBe(true)
    expect(isPlatformHost('tokoku.com', PLATFORM_HOSTS)).toBe(false)
    expect(isPlatformHost('kopi-sore.cuan.id', PLATFORM_HOSTS)).toBe(false)
  })
})

describe('storePathForHost', () => {
  it('platform memakai prefix /{slug}', () => {
    expect(storePathForHost('platform', 'kopi-sore', '/products/kopi')).toBe(
      '/kopi-sore/products/kopi'
    )
    expect(storePathForHost('platform', 'kopi-sore', '/')).toBe('/kopi-sore/')
  })

  it('custom/subdomain memakai path saja', () => {
    expect(storePathForHost('custom', 'kopi-sore', '/products/kopi')).toBe('/products/kopi')
    expect(storePathForHost('subdomain', 'kopi-sore', '/')).toBe('/')
  })
})

describe('storeUrlForHost', () => {
  it('platform memakai siteUrl + slug', () => {
    expect(
      storeUrlForHost('platform', 'jualin-delta.vercel.app', 'kopi-sore', '/products/kopi', 'https://jualin-delta.vercel.app')
    ).toBe('https://jualin-delta.vercel.app/kopi-sore/products/kopi')
  })

  it('custom memakai hostname itu sendiri', () => {
    expect(
      storeUrlForHost('custom', 'tokoku.com', 'kopi-sore', '/products/kopi', 'https://jualin-delta.vercel.app')
    ).toBe('https://tokoku.com/products/kopi')
  })
})
