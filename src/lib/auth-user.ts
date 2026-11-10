// User sesi saat ini, di-cache per request (performa 2026-11-10).
//
// supabase.auth.getUser() adalah panggilan NETWORK ke server Auth —
// bukan dekode JWT lokal. Sebelumnya ia dipanggil ulang di middleware,
// layout, halaman, dan helper dalam SATU request yang sama (bisa 4–5×
// serial per klik). Bungkus cache() ini membuat semua pemanggil dalam
// satu render berbagi satu panggilan. Client dibuat di dalam supaya
// kunci cache hanya user-nya, bukan identitas objek client.
import { cache } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})
