// Bottom navbar pembeli (mobile-first, pola mirip MobileBottomNav
// dashboard). Tampil di storefront publik, sembunyi di dashboard /
// auth / checkout / detail produk — aturannya di lib/buyer-nav.ts.
// Item: Keranjang, Pesanan, Akun — TANPA Beranda (tombol Home mengarah
// ke landing, tidak diperlukan di nav pembeli).
'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, ShoppingCart, User } from 'lucide-react'
import { cartTotalQty, useCart } from '@/lib/use-cart'
import {
  BUYER_NAV_ITEMS,
  shouldShowBuyerNav,
  storeSlugFromBuyerPathname,
} from '@/lib/buyer-nav'
import { createClient } from '@/lib/supabase/client'
import { storeThemeStyle } from '@/lib/store-themes'

const ICONS = {
  '/cart': ShoppingCart,
  '/akun/pesanan': Package,
  '/akun/profil': User,
} as const

function isActiveItem(href: string, pathname: string): boolean {
  if (href === '/cart') return pathname === '/cart'
  if (href === '/akun/pesanan') {
    // Halaman invoice adalah lacak pesanan — sorot "Pesanan" juga.
    return (
      pathname.startsWith('/akun/pesanan') || pathname.startsWith('/invoice')
    )
  }
  // "Akun": semua halaman /akun kecuali Pesanan.
  return pathname.startsWith('/akun') && !pathname.startsWith('/akun/pesanan')
}

export default function BuyerBottomNav() {
  const pathname = usePathname()
  const count = useCart((state) => cartTotalQty(state.items))

  // Tema toko (audit 2026-11-10 W-3): nav ini dirender di root layout,
  // di luar pembungkus bertema halaman toko, jadi override tema tidak
  // merambat ke sini. Ambil tema dari slug di path dan terapkan
  // sendiri. Gagal baca / bukan halaman toko = warna platform.
  // State disimpan berpasangan dengan slug pemiliknya: saat slug aktif
  // tidak cocok (baru pindah halaman / bukan halaman toko), render
  // memakai {} tanpa perlu setState sinkron di dalam effect
  // (react-hooks/set-state-in-effect).
  const slug = storeSlugFromBuyerPathname(pathname)
  const [theme, setTheme] = useState<{
    slug: string
    vars: CSSProperties
  } | null>(null)
  useEffect(() => {
    if (!slug) return
    let cancelled = false
    const supabase = createClient()
    void supabase
      .from('stores')
      .select('theme')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setTheme({
          slug,
          vars: storeThemeStyle(
            (data as { theme?: string | null } | null)?.theme ?? null
          ),
        })
      })
    return () => {
      cancelled = true
    }
  }, [slug])
  const themeVars: CSSProperties =
    slug && theme?.slug === slug ? theme.vars : {}

  if (!shouldShowBuyerNav(pathname)) return null

  return (
    <nav
      style={themeVars}
      className="fixed inset-x-4 bottom-4 z-30 mx-auto max-w-sm rounded-full border border-black/5 bg-[var(--surface)]/95 px-2 py-2 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-[0_16px_40px_rgba(33,24,20,0.18)] backdrop-blur-xl md:hidden"
    >
      <div className="grid grid-cols-3 gap-1">
        {BUYER_NAV_ITEMS.map(({ href, label }) => {
          const Icon = ICONS[href]
          const active = isActiveItem(href, pathname)
          const showBadge = href === '/cart' && count > 0
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-full px-2 text-[11px] font-semibold transition active:scale-[0.97] ${
                active
                  ? 'bg-[var(--primary)] text-white shadow-md'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-soft)]'
              }`}
            >
              <span className="relative">
                <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                {showBadge ? (
                  <span
                    className={`absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none ${
                      active
                        ? 'bg-white text-[var(--primary)]'
                        : 'bg-[var(--primary)] text-white'
                    }`}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                ) : null}
              </span>
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
