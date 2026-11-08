'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/dashboard', label: 'Beranda' },
  { href: '/dashboard/products', label: 'Produk' },
  { href: '/dashboard/orders', label: 'Pesanan' },
  { href: '/dashboard/chat', label: 'Chat' },
  { href: '/dashboard/shipping', label: 'Pengiriman' },
  { href: '/dashboard/vouchers', label: 'Voucher' },
  { href: '/dashboard/analytics', label: 'Analitik' },
  { href: '/dashboard/flash-sales', label: 'Flash Sale' },
  { href: '/dashboard/banners', label: 'Banner' },
  { href: '/dashboard/domains', label: 'Domain' },
  { href: '/dashboard/subscription', label: 'Langganan' },
  { href: '/dashboard/settings', label: 'Pengaturan' },
]

// Staff (Fase 2) hanya boleh Beranda, Produk, dan Pesanan — menu lain
// disembunyikan DAN halamannya dijaga di server (bukan hanya di nav).
const STAFF_ITEMS = [
  { href: '/dashboard', label: 'Beranda' },
  { href: '/dashboard/products', label: 'Produk' },
  { href: '/dashboard/orders', label: 'Pesanan' },
]

/**
 * Navigasi desktop — sebelumnya dashboard tidak punya menu sama sekali di
 * layar besar (bottom nav hanya tampil di mobile), sehingga halaman seperti
 * Pengiriman hanya bisa dicapai dari tautan berserakan.
 */
export default function DesktopNav({
  isStaff = false,
  isAdmin = false,
}: {
  isStaff?: boolean
  isAdmin?: boolean
}) {
  const pathname = usePathname()
  const visibleItems = isStaff
    ? STAFF_ITEMS
    : isAdmin
      ? [...items, { href: '/dashboard/admin', label: 'Admin' }]
      : items

  return (
    <nav className="mx-auto hidden max-w-6xl items-center gap-1 px-4 pb-3 md:flex">
      {visibleItems.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== '/dashboard' && pathname.startsWith(item.href))
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
