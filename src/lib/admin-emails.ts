// Email pemilik toko untuk area admin (performa 2026-11-10).
//
// Sebelumnya Beranda admin + daftar toko memanggil
// auth.admin.listUsers({ perPage: 1000 }) pada SETIAP load hanya
// untuk memetakan email pemilik yang tampil — tarik sampai 1.000
// user untuk menampilkan 5–20 email. Helper ini mengambil email
// HANYA untuk owner_id yang diberikan, paralel via getUserById
// (pola yang sudah dipakai halaman detail toko).
import type { SupabaseClient } from '@supabase/supabase-js'

export async function fetchOwnerEmails(
  admin: SupabaseClient,
  ownerIds: string[]
): Promise<Map<string, string>> {
  const emailByUserId = new Map<string, string>()
  const uniqueIds = [...new Set(ownerIds.filter(Boolean))]
  await Promise.all(
    uniqueIds.map(async (ownerId) => {
      try {
        const { data } = await admin.auth.admin.getUserById(ownerId)
        if (data.user?.email) emailByUserId.set(ownerId, data.user.email)
      } catch {
        // Email best-effort: gagal satu pemilik tidak menggagalkan
        // halaman — pemanggil jatuh ke menampilkan owner_id.
      }
    })
  )
  return emailByUserId
}
