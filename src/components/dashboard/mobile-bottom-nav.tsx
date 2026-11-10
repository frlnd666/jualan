"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Crown,
  Globe,
  Image as ImageIcon,
  LayoutGrid,
  Menu as MenuIcon,
  MessageCircle,
  Package,
  Settings,
  ShoppingBag,
  TicketPercent,
  TrendingUp,
  Truck,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import {
  activeSellerNavHref,
  isAdminRoute,
  isSellerMenuSection,
  SELLER_MOBILE_PRIMARY_HREFS,
  SELLER_NAV_ITEMS,
  SELLER_STAFF_NAV_ITEMS,
} from '@/lib/dashboard-nav'
import AdminMobileBottomNav from '@/components/dashboard/AdminMobileBottomNav'

// Ikon per href — daftar itemnya sendiri berasal dari SELLER_NAV_ITEMS
// (sumber tunggal, sama dengan nav desktop), jadi menu mobile tidak
// bisa lagi tertinggal dari menu desktop.
const ICONS: Record<string, LucideIcon> = {
  '/dashboard': LayoutGrid,
  '/dashboard/products': Package,
  '/dashboard/orders': ShoppingBag,
  '/dashboard/chat': MessageCircle,
  '/dashboard/shipping': Truck,
  '/dashboard/vouchers': TicketPercent,
  '/dashboard/analytics': TrendingUp,
  '/dashboard/flash-sales': Zap,
  '/dashboard/banners': ImageIcon,
  '/dashboard/domains': Globe,
  '/dashboard/subscription': Crown,
  '/dashboard/settings': Settings,
}

const itemClass = (active: boolean) =>
  `flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-semibold transition active:scale-[0.98] ${active ? 'bg-[var(--primary-soft)] text-[var(--primary)]' : 'text-[var(--text-muted)]'}`

// Nav bawah mobile penjual. Pemilik toko: 4 tombol utama (Beranda,
// Produk, Pesanan, Chat) + tombol Menu yang membuka sheet berisi
// SELURUH 12 menu yang sama dengan desktop — sebelumnya 6 menu
// (Pengiriman, Voucher, Analitik, Flash Sale, Banner, Domain) tidak
// punya jalan masuk di HP, dan Domain benar-benar yatim. Staff: 3
// tombol saja (memang hanya boleh 3 halaman itu). Admin TIDAK ditempel
// di sini: di route /dashboard/admin/* komponen ini menampilkan
// AdminMobileBottomNav (nav admin sendiri).
export default function MobileBottomNav({
  isStaff = false,
}: {
  isStaff?: boolean
}) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  // Navigasi (klik item sheet / tombol utama) menutup sheet.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // Escape menutup sheet; kunci scroll body selama sheet terbuka.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [menuOpen])

  // Area admin punya navbar sendiri.
  if (isAdminRoute(pathname)) return <AdminMobileBottomNav />

  if (isStaff) {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-[color:var(--surface)/0.92] px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-3 gap-1">
          {SELLER_STAFF_NAV_ITEMS.map(({ href, label }) => {
            const Icon = ICONS[href]
            const active =
              pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link key={href} href={href} className={itemClass(active)}>
                <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    )
  }

  const activeHref = activeSellerNavHref(pathname)
  const menuHighlighted = menuOpen || isSellerMenuSection(pathname)
  const primaryItems = SELLER_NAV_ITEMS.filter((item) =>
    SELLER_MOBILE_PRIMARY_HREFS.includes(item.href)
  )

  return (
    <>
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu dashboard">
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 h-full w-full bg-black/45"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-[var(--line)] bg-[var(--surface)] px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-[var(--text)]">Menu</p>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Tutup menu"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text-muted)] transition active:scale-[0.96]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SELLER_NAV_ITEMS.map(({ href, label }) => {
                const Icon = ICONS[href]
                const active = activeHref === href
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl px-2 text-center text-[11px] font-semibold transition active:scale-[0.98] ${active ? 'bg-[var(--primary-soft)] text-[var(--primary)]' : 'bg-[var(--surface-soft)] text-[var(--text)]'}`}
                  >
                    <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                    <span>{label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-[color:var(--surface)/0.92] px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-5 gap-1">
          {primaryItems.map(({ href, label }) => {
            const Icon = ICONS[href]
            const active = activeHref === href
            return (
              <Link key={href} href={href} className={itemClass(active)}>
                <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                <span>{label}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="Buka menu lengkap"
            className={itemClass(menuHighlighted)}
          >
            <MenuIcon size={18} strokeWidth={menuHighlighted ? 2.4 : 2} />
            <span>Menu</span>
          </button>
        </div>
      </nav>
    </>
  )
}
