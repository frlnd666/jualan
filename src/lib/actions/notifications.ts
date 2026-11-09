// Notifikasi in-app — SERVER ACTIONS (Fase 3).
// Daftar + tandai dibaca, selalu untuk user yang login (RLS
// penerima-only di tabel notifications).

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { NotificationType } from '@/lib/notifications'
import { sendEmail } from '@/lib/email-resend'
import { sendWhatsAppMessage, normalizeWhatsAppNumber } from '@/lib/whatsapp'

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

  // P2-05: hitung belum-dibaca dengan query count terpisah — daftar di
  // atas dibatasi 50, jadi menghitung dari `items` mentok di 50 bila
  // unread lebih dari itu.
  const { count: unreadTotal } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  const items = ((data ?? []) as NotificationRow[]).map((n) => ({
    ...n,
    body: n.body ?? '',
  }))
  return { items, unreadCount: unreadTotal ?? 0 }
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

// ---------------------------------------------------------------------------
// Tes kirim admin (halaman /dashboard/admin/notifications).
// Email tes dikirim ke email admin sendiri; WA tes ke nomor yang diisi.
// Admin-only. Mengembalikan hasil PER CHANNEL supaya jelas mana yang
// jalan dan mana yang dilewati (mis. provider belum dikonfigurasi).
// ---------------------------------------------------------------------------

export interface NotificationTestChannelResult {
  status: 'sent' | 'skipped' | 'failed'
  detail: string
}

export async function sendNotificationTestAction(formData: FormData): Promise<
  | {
      success: true
      email: NotificationTestChannelResult
      whatsapp: NotificationTestChannelResult
    }
  | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin')
  if (adminError || isAdmin !== true) {
    return { error: 'Hanya admin platform yang boleh mengirim tes notifikasi.' }
  }

  const phone = normalizeWhatsAppNumber(String(formData.get('phone') ?? ''))

  const emailResult: NotificationTestChannelResult = await (async () => {
    const sent = await sendEmail({
      to: user.email ?? '',
      subject: 'Tes notifikasi email CUAN',
      html: '<!doctype html><html lang="id"><body style="font-family:system-ui,sans-serif;color:#1f1a17"><h1 style="color:#0b6b4a">CUAN</h1><p>Ini email tes dari CUAN. Kalau kamu menerima ini, pengiriman email (Resend) sudah jalan.</p><p>Email otomatis — jangan dibalas.</p></body></html>',
    })
    if (sent.ok) return { status: 'sent' as const, detail: 'Terkirim ke email admin.' }
    if (sent.skipped) return { status: 'skipped' as const, detail: sent.reason }
    return { status: 'failed' as const, detail: sent.error }
  })()

  const whatsappResult: NotificationTestChannelResult = await (async () => {
    if (!phone) {
      return {
        status: 'skipped' as const,
        detail: 'Nomor WhatsApp tidak diisi — isi nomor untuk tes WA.',
      }
    }
    const sent = await sendWhatsAppMessage({
      to: phone,
      templateName: process.env.WHATSAPP_TEMPLATE_TEST || 'cuan_test',
      parameters: ['Tes notifikasi CUAN'],
    })
    if (sent.ok) return { status: 'sent' as const, detail: 'Terkirim ke nomor di atas.' }
    if (sent.skipped) return { status: 'skipped' as const, detail: sent.reason }
    return { status: 'failed' as const, detail: sent.error }
  })()

  return { success: true, email: emailResult, whatsapp: whatsappResult }
}
