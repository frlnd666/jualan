'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/dashboard', label: 'Beranda' },
  { href: '/dashboard/products', label: 'Produk' },
  { href: '/dashboard/orders', label: 'Pesanan' },
  { href: '/dashboard/chat', label: 'Chat' },
  { href: '/dashboard/shipping', label: 'Pengiriman' },
  { href: '/dashboard/settings', label: 'Pengaturan' },
]

/**
 * Navigasi desktop — sebelumnya dashboard tidak punya menu sama sekali di
 * layar besar (bottom nav hanya tampil di mobile), sehingga halaman seperti
 * Pengiriman hanya bisa dicapai dari tautan berserakan.
 */
export default function DesktopNav() {
  const pathname = usePathname()

  return (
    <nav className="mx-auto hidden max-w-6xl items-center gap-1 px-4 pb-3 md:flex">
      {items.map((item) => {
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
