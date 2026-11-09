// Nav tab desktop admin — nav sendiri untuk area /dashboard/admin,
// bukan item "Admin" yang ditempel di nav penjual. Styling mengikuti
// DesktopNav (pill tab, tampil md ke atas).
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ADMIN_NAV_ITEMS, isAdminNavItemActive } from '@/lib/dashboard-nav'

export default function AdminDesktopNav() {
  const pathname = usePathname()

  return (
    <nav className="mx-auto hidden max-w-6xl items-center gap-1 px-4 pb-3 md:flex">
      {ADMIN_NAV_ITEMS.map((item) => {
        const active = isAdminNavItemActive(item.href, pathname)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
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
