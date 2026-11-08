// Daftar notifikasi (Fase 3) — Client Component.
// Klik item = tandai dibaca lalu buka tautannya. Dipakai halaman
// dashboard (/dashboard/notifications) dan akun pembeli (/akun/notifikasi).
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  type NotificationRow,
} from '@/lib/actions/notifications'

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(date)
}

export default function NotificationsList({
  items,
  emptyText,
}: {
  items: NotificationRow[]
  emptyText: string
}) {
  const router = useRouter()
  const [markingAll, setMarkingAll] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  async function openItem(item: NotificationRow) {
    if (!item.is_read && !readIds.has(item.id)) {
      setReadIds((prev) => new Set(prev).add(item.id))
      await markNotificationReadAction(item.id)
    }
  }

  async function markAll() {
    setMarkingAll(true)
    await markAllNotificationsReadAction()
    setMarkingAll(false)
    router.refresh()
  }

  const unread = items.filter((n) => !n.is_read && !readIds.has(n.id)).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {unread > 0 ? `${unread} belum dibaca` : 'Semua sudah dibaca.'}
        </p>
        {unread > 0 ? (
          <button
            type="button"
            onClick={markAll}
            disabled={markingAll}
            className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 disabled:opacity-50"
          >
            {markingAll ? 'Menandai...' : 'Tandai semua dibaca'}
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-gray-900">{emptyText}</p>
        </div>
      ) : (
        items.map((item) => {
          const isRead = item.is_read || readIds.has(item.id)
          const inner = (
            <div
              className={`rounded-3xl border p-4 shadow-sm transition hover:shadow ${
                isRead ? 'border-gray-100 bg-white' : 'border-indigo-200 bg-indigo-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold text-gray-900">{item.title}</p>
                <span className="shrink-0 text-xs text-gray-500">
                  {formatTime(item.created_at)}
                </span>
              </div>
              {item.body ? (
                <p className="mt-1 text-sm leading-6 text-gray-600">{item.body}</p>
              ) : null}
              {!isRead ? (
                <span className="mt-2 inline-flex rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  Baru
                </span>
              ) : null}
            </div>
          )
          return item.link ? (
            <Link
              key={item.id}
              href={item.link}
              onClick={() => openItem(item)}
              className="block"
            >
              {inner}
            </Link>
          ) : (
            <div
              key={item.id}
              onClick={() => openItem(item)}
              className="cursor-pointer"
            >
              {inner}
            </div>
          )
        })
      )}
    </div>
  )
}
