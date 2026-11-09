// Navigasi akun pembeli (client — butuh pathname untuk status aktif).
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/akun/profil', label: 'Profil' },
  { href: '/akun/pesanan', label: 'Pesanan Saya' },
  { href: '/akun/alamat', label: 'Alamat Saya' },
  { href: '/akun/notifikasi', label: 'Notifikasi' },
  { href: '/cart', label: 'Keranjang' },
]

export default function AkunNav() {
  const pathname = usePathname()

  return (
    <nav className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const active = pathname.startsWith(item.href)
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
