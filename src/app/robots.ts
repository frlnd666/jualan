// robots.txt (Fase 5) — izinkan semua crawler ke halaman publik,
// tutup area privat (dashboard, akun, checkout, invoice, API).
import type { MetadataRoute } from 'next'
import { siteUrlFromEnv } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = siteUrlFromEnv(process.env.NEXT_PUBLIC_SITE_URL)
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/akun',
          '/checkout',
          '/cart',
          '/invoice',
          '/track',
          '/api',
          '/auth',
          '/login',
          '/register',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
