'use server'

import { headers } from 'next/headers'
import { createPublicInvoiceClient } from '@/lib/invoice-access'
import { checkRateLimit } from '@/lib/rate-limit'

export interface ChatMessageDTO {
  id: number
  sender: 'buyer' | 'seller'
  body: string
  created_at: string
}

export interface StartChatResult {
  success: boolean
  error?: string
  sessionId?: string
  accessToken?: string
}

const MAX_BODY_LENGTH = 2000

/**
 * Sisi pembeli (tamu). Semua akses lewat client service-role (bila
 * terkonfigurasi) dan SELALU divalidasi dengan access_token sesi —
 * pola yang sama seperti halaman invoice publik. Tanpa service role,
 * chat tidak aktif (RLS tidak memberi akses langsung ke anon).
 */
export async function startChatSession(input: {
  storeId: string
  buyerName: string
  buyerPhone?: string
}): Promise<StartChatResult> {
  const buyerName = input.buyerName?.trim()
  if (!input.storeId) return { success: false, error: 'Toko tidak ditemukan.' }
  if (!buyerName) return { success: false, error: 'Nama wajib diisi.' }
  if (buyerName.length > 80) return { success: false, error: 'Nama terlalu panjang.' }

  const requestHeaders = await headers()
  const clientIp =
    requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const limit = checkRateLimit(`chat:start:${clientIp}`, 5, 10 * 60 * 1000)
  if (!limit.allowed) {
    return { success: false, error: 'Terlalu banyak sesi chat baru. Coba lagi nanti.' }
  }

  const supabase = await createPublicInvoiceClient()

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('id', input.storeId)
    .maybeSingle()

  if (!store) return { success: false, error: 'Toko tidak ditemukan.' }

  const { data: session, error } = await supabase
    .from('chat_sessions')
    .insert({
      store_id: input.storeId,
      buyer_name: buyerName,
      buyer_phone: input.buyerPhone?.trim() || null,
    })
    .select('id, access_token')
    .single()

  if (error || !session) {
    return {
      success: false,
      error: 'Chat belum bisa dimulai. Coba lagi sebentar lagi.',
    }
  }

  return { success: true, sessionId: session.id, accessToken: session.access_token }
}

async function getOwnedSession(sessionId: string, accessToken: string) {
  const supabase = await createPublicInvoiceClient()
  const { data: session } = await supabase
    .from('chat_sessions')
    .select('id, store_id, buyer_name')
    .eq('id', sessionId)
    .eq('access_token', accessToken)
    .maybeSingle()
  return { supabase, session }
}

export async function getChatMessages(
  sessionId: string,
  accessToken: string
): Promise<{ success: boolean; error?: string; messages?: ChatMessageDTO[] }> {
  if (!sessionId || !accessToken) {
    return { success: false, error: 'Sesi chat tidak valid.' }
  }

  const { supabase, session } = await getOwnedSession(sessionId, accessToken)
  if (!session) return { success: false, error: 'Sesi chat tidak ditemukan.' }

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('id, sender, body, created_at')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true })
    .limit(200)

  return { success: true, messages: (messages ?? []) as ChatMessageDTO[] }
}

export async function sendChatMessage(
  sessionId: string,
  accessToken: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const text = body?.trim()
  if (!sessionId || !accessToken) {
    return { success: false, error: 'Sesi chat tidak valid.' }
  }
  if (!text) return { success: false, error: 'Pesan tidak boleh kosong.' }
  if (text.length > MAX_BODY_LENGTH) {
    return { success: false, error: 'Pesan terlalu panjang (maks 2000 karakter).' }
  }

  const limit = checkRateLimit(`chat:send:${sessionId}`, 30, 5 * 60 * 1000)
  if (!limit.allowed) {
    return { success: false, error: 'Terlalu cepat. Tunggu sebentar sebelum mengirim lagi.' }
  }

  const { supabase, session } = await getOwnedSession(sessionId, accessToken)
  if (!session) return { success: false, error: 'Sesi chat tidak ditemukan.' }

  const { error } = await supabase.from('chat_messages').insert({
    session_id: session.id,
    sender: 'buyer',
    body: text,
  })

  if (error) return { success: false, error: 'Pesan gagal dikirim.' }

  await supabase
    .from('chat_sessions')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', session.id)

  return { success: true }
}
