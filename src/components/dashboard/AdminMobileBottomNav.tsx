// Bottom navbar admin (mobile) — nav sendiri untuk area /dashboard/admin,
// bukan item "Admin" yang ditempel di nav penjual. Styling mengikuti
// MobileBottomNav: fixed bottom, md:hidden, backdrop-blur, grid 5 kolom.
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, Crown, LayoutDashboard, ScrollText, Store } from 'lucide-react'
import { ADMIN_NAV_ITEMS, isAdminNavItemActive } from '@/lib/dashboard-nav'

const ICONS = {
  '/dashboard/admin': LayoutDashboard,
  '/dashboard/admin/stores': Store,
  '/dashboard/admin/subscriptions': Crown,
  '/dashboard/admin/audit': ScrollText,
  '/dashboard/admin/notifications': Bell,
} as const

export default function AdminMobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-[color:var(--surface)/0.92] px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-6xl grid-cols-5 gap-1">
        {ADMIN_NAV_ITEMS.map(({ href, label }) => {
          const Icon = ICONS[href]
          const active = isAdminNavItemActive(href, pathname)
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
