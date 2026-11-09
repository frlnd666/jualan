// Bottom navbar pembeli (mobile-first, pola mirip MobileBottomNav
// dashboard). Tampil di storefront publik, sembunyi di dashboard /
// auth / checkout / detail produk — aturannya di lib/buyer-nav.ts.
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Package, ShoppingCart, User } from 'lucide-react'
import { cartTotalQty, useCart } from '@/lib/use-cart'
import { shouldShowBuyerNav } from '@/lib/buyer-nav'

const items = [
  { href: '/', label: 'Beranda', icon: Home },
  { href: '/cart', label: 'Keranjang', icon: ShoppingCart },
  { href: '/akun/pesanan', label: 'Pesanan', icon: Package },
  { href: '/akun/profil', label: 'Akun', icon: User },
] as const

function isActiveItem(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/'
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

  if (!shouldShowBuyerNav(pathname)) return null

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-[#fffaf5]/95 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-6xl grid-cols-4 gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActiveItem(href, pathname)
          const showBadge = href === '/cart' && count > 0
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-semibold transition active:scale-[0.98] ${
                active
                  ? 'bg-emerald-50 text-[#0b6b4a]'
                  : 'text-[#8d7f73]'
              }`}
            >
              <span className="relative">
                <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                {showBadge ? (
                  <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#5b3df5] px-1 text-[9px] font-bold leading-none text-white">
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
