'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  isAdminRoute,
  SELLER_NAV_ITEMS,
  SELLER_STAFF_NAV_ITEMS,
} from '@/lib/dashboard-nav'
import AdminDesktopNav from '@/components/dashboard/AdminDesktopNav'

/**
 * Navigasi desktop penjual — sebelumnya dashboard tidak punya menu sama
 * sekali di layar besar (bottom nav hanya tampil di mobile), sehingga
 * halaman seperti Pengiriman hanya bisa dicapai dari tautan berserakan.
 *
 * Admin TIDAK ditempel di sini: di route /dashboard/admin/* komponen
 * ini menampilkan AdminDesktopNav (nav admin sendiri).
 */
export default function DesktopNav({
  isStaff = false,
}: {
  isStaff?: boolean
}) {
  const pathname = usePathname()

  // Area admin punya navbar sendiri.
  if (isAdminRoute(pathname)) return <AdminDesktopNav />

  const visibleItems = isStaff ? SELLER_STAFF_NAV_ITEMS : SELLER_NAV_ITEMS

  return (
    <nav className="mx-auto hidden max-w-6xl items-center gap-1 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex">
      {visibleItems.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== '/dashboard' && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              active
                ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)]'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
