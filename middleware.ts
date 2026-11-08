import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  classifyHostname,
  platformDomainFromEnv,
} from '@/lib/domains'

// Fase 5 — host yang dilayani sebagai storefront toko:
// - platform: landing + dashboard + path /{slug} (biasa);
// - subdomain platform {slug}.domain-platform → rewrite ke /{slug};
// - domain custom terverifikasi → resolve lewat tabel store_domains,
//   rewrite ke /{slug} (URL tetap domain custom, tanpa redirect).
// Hanya path storefront ('/' dan '/products/...') yang di-rewrite —
// halaman global (checkout, cart, invoice, auth, api, sitemap) tetap
// lewat seperti biasa. Header x-cuan-host-kind / x-cuan-store-slug
// dibaca halaman storefront untuk membangun tautan yang tetap di host
// yang sama (lihat lib/store-links.ts).
async function resolveStorefrontHost(
  request: NextRequest,
  supabase: ReturnType<typeof createServerClient>
): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname
  const isStorefrontPath =
    pathname === '/' || pathname.startsWith('/products/')
  if (!isStorefrontPath) return null

  const rawHost = request.headers.get('host') ?? ''
  const host = rawHost.split(':')[0]?.toLowerCase() ?? ''
  if (!host) return null

  const platformDomain = platformDomainFromEnv(
    process.env.NEXT_PUBLIC_PLATFORM_DOMAIN
  )
  const classified = classifyHostname(host, platformDomain)
  if (classified.kind === 'platform') return null

  const rewriteWithStore = (slug: string, kind: 'subdomain' | 'custom') => {
    const url = request.nextUrl.clone()
    url.pathname = `/${slug}${pathname}`
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-cuan-host-kind', kind)
    requestHeaders.set('x-cuan-store-slug', slug)
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
  }

  if (classified.kind === 'subdomain' && classified.slug) {
    return rewriteWithStore(classified.slug, 'subdomain')
  }

  // Domain custom — cari di store_domains yang sudah terverifikasi.
  // Tabel belum ada (migrasi f5 belum jalan) atau domain tidak dikenal
  // = halaman penjelasan, bukan crash.
  try {
    const { data } = await supabase
      .from('store_domains')
      .select('store_id')
      .eq('domain', host)
      .eq('status', 'verified')
      .maybeSingle()
    const row = data as { store_id: string } | null
    if (!row) {
      const url = request.nextUrl.clone()
      url.pathname = '/domain-tidak-dikenal'
      url.searchParams.set('host', host)
      return NextResponse.rewrite(url)
    }
    const { data: store } = await supabase
      .from('stores')
      .select('slug')
      .eq('id', row.store_id)
      .maybeSingle()
    const storeRow = store as { slug: string } | null
    if (!storeRow?.slug) {
      const url = request.nextUrl.clone()
      url.pathname = '/domain-tidak-dikenal'
      url.searchParams.set('host', host)
      return NextResponse.rewrite(url)
    }
    return rewriteWithStore(storeRow.slug, 'custom')
  } catch {
    const url = request.nextUrl.clone()
    url.pathname = '/domain-tidak-dikenal'
    url.searchParams.set('host', host)
    return NextResponse.rewrite(url)
  }
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Fase 5: host custom/subdomain dilayani sebagai storefront toko.
  const storefront = await resolveStorefrontHost(request, supabase)
  if (storefront) return storefront

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  if (!user && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (pathname === '/login' || pathname === '/register')) {
    // Fase 2: pembeli yang sudah login diarahkan ke /akun, bukan
    // /dashboard. Peran dibaca dari profiles; bila belum ada baris
    // (pembeli baru dari register ?type=buyer), pakai cookie
    // cuan_account_type sebagai penanda sementara.
    let destination = '/dashboard'
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.role === 'buyer') destination = '/akun'
      else if (request.cookies.get('cuan_account_type')?.value === 'buyer') {
        destination = '/akun'
      }
    } catch {}
    return NextResponse.redirect(new URL(destination, request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}