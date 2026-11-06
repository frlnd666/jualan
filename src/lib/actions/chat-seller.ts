'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Balasan seller dari dashboard. Memakai client user biasa — RLS
 * (chat_messages_owner_insert) memastikan sesi ini milik toko seller
 * dan memaksa sender = 'seller'.
 */
export async function sendSellerMessage(
  sessionId: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const text = body?.trim()
  if (!sessionId) return { success: false, error: 'Sesi chat tidak valid.' }
  if (!text) return { success: false, error: 'Pesan tidak boleh kosong.' }
  if (text.length > 2000) {
    return { success: false, error: 'Pesan terlalu panjang (maks 2000 karakter).' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Sesi login tidak ditemukan.' }

  const { error } = await supabase.from('chat_messages').insert({
    session_id: sessionId,
    sender: 'seller',
    body: text,
  })

  if (error) {
    return { success: false, error: 'Pesan gagal dikirim. Pastikan sesi ini milik tokomu.' }
  }

  await supabase
    .from('chat_sessions')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', sessionId)

  revalidatePath('/dashboard/chat')
  return { success: true }
}
