import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client memakai service_role key.
 *
 * Dipakai khusus untuk lookup publik yang terkunci token (halaman
 * invoice/tracking + upload bukti transfer), supaya tabel orders/invoices
 * bisa ditutup dari akses anon langsung lewat RLS (lihat
 * supabase/migrations/20261107_p0_security.sql).
 *
 * JANGAN pernah diimpor dari Client Component: key ini melewati semua RLS.
 * Mengembalikan null bila env belum diset — pemanggil wajib fallback sadar
 * (client anon biasa) agar aplikasi lama tidak langsung mati sebelum
 * aktivasi selesai. Setelah migrasi RLS dijalankan, env ini WAJIB ada.
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('createAdminClient hanya boleh dipakai di server.')
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    return null
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function isAdminClientConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}
