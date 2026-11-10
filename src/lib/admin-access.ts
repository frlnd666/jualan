// Penjaga halaman/aksi admin platform (Fase 2).
// Semua halaman /dashboard/admin/* memakai helper ini — non-admin
// tidak boleh masuk (bukan hanya disembunyikan dari menu).
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/auth-user'

export async function isAdminUser(
  supabase: SupabaseClient
): Promise<boolean> {
  const { data } = await supabase.rpc('is_admin')
  return data === true
}

export async function requireAdminUser(
  supabase: SupabaseClient
): Promise<{ userId: string } | { error: string }> {
  // Performa 2026-11-10: user dari cache per-request — halaman admin
  // biasanya sudah memanggil getUser sendiri; jangan validasi dua kali.
  const user = await getCurrentUser()
  if (!user) return { error: 'Kamu harus login.' }
  if (!(await isAdminUser(supabase))) {
    return { error: 'Halaman ini hanya untuk admin platform.' }
  }
  return { userId: user.id }
}
