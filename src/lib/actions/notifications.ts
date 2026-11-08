// Notifikasi in-app — SERVER ACTIONS (Fase 3).
// Daftar + tandai dibaca, selalu untuk user yang login (RLS
// penerima-only di tabel notifications).

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { NotificationType } from '@/lib/notifications'

export interface NotificationRow {
  id: string
  type: NotificationType
  title: string
  body: string
  link: string | null
  order_id: string | null
  is_read: boolean
  created_at: string
}

export async function listNotificationsAction(): Promise<{
  items: NotificationRow[]
  unreadCount: number
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { items: [], unreadCount: 0 }

  const { data } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, order_id, is_read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const items = ((data ?? []) as NotificationRow[]).map((n) => ({
    ...n,
    body: n.body ?? '',
  }))
  return { items, unreadCount: items.filter((n) => !n.is_read).length }
}

export async function getUnreadNotificationCountAction(): Promise<number> {
  const { unreadCount } = await listNotificationsAction()
  return unreadCount
}

export async function markNotificationReadAction(
  notificationId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id)

  if (error) return { error: 'Gagal menandai notifikasi.' }
  revalidatePath('/dashboard/notifications')
  revalidatePath('/akun/notifikasi')
  return { success: true }
}

export async function markAllNotificationsReadAction(): Promise<{
  success?: boolean
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) return { error: 'Gagal menandai semua notifikasi.' }
  revalidatePath('/dashboard/notifications')
  revalidatePath('/akun/notifikasi')
  return { success: true }
}
