// Lonceng notifikasi di header dashboard (Fase 3) — Client Component.
// Badge angka = jumlah belum dibaca (di-hitung server di layout).
// Tujuan lonceng mengikuti area: di route admin menuju halaman tes
// notifikasi admin, di luar itu menuju inbox notifikasi penjual.
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { notificationHrefFor } from '@/lib/dashboard-nav'

export default function NotificationBell({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname()
  return (
    <Link
      href={notificationHrefFor(pathname)}
      aria-label={`Notifikasi${unreadCount > 0 ? `, ${unreadCount} belum dibaca` : ''}`}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)] transition active:scale-[0.98]"
    >
      <Bell className="h-5 w-5 text-[var(--text)]" aria-hidden />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--error)] px-1 text-[10px] font-bold text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </Link>
  )
}
