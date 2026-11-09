// Preferensi notifikasi email + WhatsApp — SERVER ACTIONS.
// Satu baris per user di notification_preferences (migrasi
// 20261109_notification_prefs.sql). Tidak ada baris = semua aktif
// (lihat DEFAULT_NOTIFICATION_PREFERENCES di lib/notify.ts).
// RLS owner-only: user hanya bisa baca/ubah barisnya sendiri.

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '@/lib/notify'
import { normalizePhoneNumber } from '@/lib/utils/order'

function isMissingTableError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return false
  }
  const message = String(error.message)
  return message.includes('notification_preferences')
}

export async function getNotificationPreferencesAction(): Promise<{
  prefs: NotificationPreferences
  migrationMissing: boolean
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { prefs: { ...DEFAULT_NOTIFICATION_PREFERENCES }, migrationMissing: false }
  }

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('email_enabled, whatsapp_enabled, whatsapp_number')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    // Tabel belum ada (migrasi belum dijalankan) → default + penanda.
    return {
      prefs: { ...DEFAULT_NOTIFICATION_PREFERENCES },
      migrationMissing: isMissingTableError(error),
    }
  }
  if (!data) {
    return { prefs: { ...DEFAULT_NOTIFICATION_PREFERENCES }, migrationMissing: false }
  }
  const row = data as {
    email_enabled?: boolean | null
    whatsapp_enabled?: boolean | null
    whatsapp_number?: string | null
  }
  return {
    prefs: {
      emailEnabled: row.email_enabled ?? true,
      whatsappEnabled: row.whatsapp_enabled ?? true,
      whatsappNumber: row.whatsapp_number ?? null,
    },
    migrationMissing: false,
  }
}

export async function saveNotificationPreferencesAction(formData: FormData): Promise<{
  success?: boolean
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const emailEnabled = formData.get('emailEnabled') === 'on'
  const whatsappEnabled = formData.get('whatsappEnabled') === 'on'
  const rawNumber = String(formData.get('whatsappNumber') ?? '').trim()
  const whatsappNumber = rawNumber ? normalizePhoneNumber(rawNumber) : null
  if (whatsappNumber && whatsappNumber.length > 20) {
    return { error: 'Nomor WhatsApp tidak valid.' }
  }

  const { error } = await supabase.from('notification_preferences').upsert(
    {
      user_id: user.id,
      email_enabled: emailEnabled,
      whatsapp_enabled: whatsappEnabled,
      whatsapp_number: whatsappNumber,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (error) {
    return {
      error: isMissingTableError(error)
        ? 'Tabel preferensi belum ada — jalankan migrasi 20261109_notification_prefs.sql dulu.'
        : 'Gagal menyimpan pengaturan.',
    }
  }

  revalidatePath('/akun/notifikasi')
  revalidatePath('/dashboard/notifications')
  return { success: true }
}
