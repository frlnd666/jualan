import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * Akses publik ke invoice dilindungi `access_token` acak per invoice
 * (kolom ditambahkan oleh supabase/migrations/20261107_p0_security.sql).
 * Nomor invoice saja tidak lagi cukup untuk membuka data order.
 *
 * Kompatibilitas mundur: invoice lama / skema pra-migrasi yang belum punya
 * token diperlakukan sebagai mode legacy (token tidak dituntut), TAPI data
 * pribadi di halaman publik tetap disamarkan lewat lib/utils/privacy.
 * Setelah migrasi dijalankan, semua invoice baru selalu punya token.
 */

export async function createPublicInvoiceClient(): Promise<SupabaseClient> {
  const admin = createAdminClient()
  if (admin) return admin as unknown as SupabaseClient
  return (await createClient()) as unknown as SupabaseClient
}

/** Ambil access_token sebuah invoice; null bila kolom belum ada / token kosong. */
export async function getInvoiceAccessToken(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select('access_token')
    .eq('id', invoiceId)
    .maybeSingle()

  if (error || !data) return null
  const token = (data as { access_token?: string | null }).access_token
  return token ? String(token) : null
}

/**
 * Token cocok bila invoice memang belum bertoken (legacy) ATAU token yang
 * diberikan persis sama. Perbandingan sederhana memadai di sini karena token
 * adalah UUID acak 122-bit dan halaman ini bukan endpoint finansial.
 */
export function isInvoiceTokenValid(
  storedToken: string | null,
  providedToken: string | null | undefined
) {
  if (!storedToken) return true
  return Boolean(providedToken) && providedToken === storedToken
}

/** Suffix query `?t=` untuk dipertahankan saat berpindah invoice <-> tracking. */
export function tokenQuery(storedToken: string | null) {
  return storedToken ? `?t=${encodeURIComponent(storedToken)}` : ''
}
