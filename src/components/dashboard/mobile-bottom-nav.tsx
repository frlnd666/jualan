"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Package, ShoppingBag, MessageCircle, Store } from 'lucide-react'

const items = [
  { href: '/dashboard', label: 'Home', icon: LayoutGrid },
  { href: '/dashboard/products', label: 'Produk', icon: Package },
  { href: '/dashboard/orders', label: 'Pesanan', icon: ShoppingBag },
  { href: '/dashboard/chat', label: 'Chat', icon: MessageCircle },
  { href: '/dashboard/settings', label: 'Toko', icon: Store },
]

export default function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-[color:var(--surface)/0.92] px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-6xl grid-cols-5 gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-semibold transition active:scale-[0.98] ${active ? 'bg-[var(--primary-soft)] text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}
            >
              <Icon size={18} strokeWidth={active ? 2.4 : 2} />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
