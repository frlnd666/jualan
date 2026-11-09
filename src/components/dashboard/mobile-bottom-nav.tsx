"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Package, ShoppingBag, MessageCircle, Store, Crown } from 'lucide-react'
import { isAdminRoute } from '@/lib/dashboard-nav'
import AdminMobileBottomNav from '@/components/dashboard/AdminMobileBottomNav'

const items = [
  { href: '/dashboard', label: 'Home', icon: LayoutGrid },
  { href: '/dashboard/products', label: 'Produk', icon: Package },
  { href: '/dashboard/orders', label: 'Pesanan', icon: ShoppingBag },
  { href: '/dashboard/chat', label: 'Chat', icon: MessageCircle },
  { href: '/dashboard/subscription', label: 'Paket', icon: Crown },
  { href: '/dashboard/settings', label: 'Toko', icon: Store },
]

// Staff (Fase 2) hanya Home, Produk, Pesanan.
const STAFF_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: LayoutGrid },
  { href: '/dashboard/products', label: 'Produk', icon: Package },
  { href: '/dashboard/orders', label: 'Pesanan', icon: ShoppingBag },
]

// Nav bawah penjual — murni 6 item (staff 3 item). Admin TIDAK ditempel
// di sini: di route /dashboard/admin/* komponen ini menampilkan
// AdminMobileBottomNav (nav admin sendiri).
export default function MobileBottomNav({
  isStaff = false,
}: {
  isStaff?: boolean
}) {
  const pathname = usePathname()

  // Area admin punya navbar sendiri.
  if (isAdminRoute(pathname)) return <AdminMobileBottomNav />

  const visibleItems = isStaff ? STAFF_ITEMS : items
  const cols = isStaff ? 'grid-cols-3' : 'grid-cols-6'

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-[color:var(--surface)/0.92] px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
      <div className={`mx-auto grid max-w-6xl gap-1 ${cols}`}>
        {visibleItems.map(({ href, label, icon: Icon }) => {
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
