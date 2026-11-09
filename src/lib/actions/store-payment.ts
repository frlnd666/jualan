// Aksi bagian Pembayaran di Pengaturan toko (K-05, 'use server').
//
// Masalah yang diselesaikan: sejak K-03, peran anon/authenticated TIDAK
// bisa membaca kolom rekening di tabel stores — jadi halaman Pengaturan
// (client) tidak bisa lagi memuat rekening lewat client anon seperti
// bagian lainnya. Kedua aksi di sini menutup celah itu:
//
// - Baca (getStorePaymentAction): verifikasi pemilik dulu lewat
//   getDashboardAccess, lalu baca kolom rekening lewat service_role.
//   Rekening hanya dikembalikan ke pemilik toko yang terverifikasi.
// - Tulis (saveStorePaymentAction): validasi server-side dulu
//   (validateStorePayment), lalu tulis lewat client anon + policy owner
//   — RLS sudah membatasi update ke baris milik pemanggil, dan pola ini
//   sama dengan saveOnboardingPaymentAction. Service_role HANYA dipakai
//   untuk MEMBACA kolom yang dicabut K-03, bukan untuk menulis.
//
// Hanya pemilik toko yang boleh memanggil keduanya (staff ditolak:
// getDashboardAccess mengembalikan role 'staff' untuk mereka, admin
// platform tidak punya toko sehingga access-nya null).
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDashboardAccess } from '@/lib/dashboard-access'
import {
  validateStorePayment,
  type StorePaymentInput,
} from '@/lib/store-payment'

export type StorePaymentData = {
  bank_name: string | null
  bank_account_name: string | null
  bank_account_number: string | null
  qris_image_url: string | null
  cod_enabled: boolean | null
}

async function requireOwnerStoreId(): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; storeId: string }
  | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const access = await getDashboardAccess(supabase, user.id)
  if (!access || access.role !== 'owner') {
    return { error: 'Hanya pemilik toko yang bisa mengubah pembayaran.' }
  }
  return { supabase, storeId: access.store.id }
}

export async function getStorePaymentAction(): Promise<
  { payment: StorePaymentData } | { error: string }
> {
  const owner = await requireOwnerStoreId()
  if ('error' in owner) return { error: owner.error }

  const admin = createAdminClient()
  if (!admin) return { error: 'Konfigurasi server belum lengkap.' }

  const { data, error } = await admin
    .from('stores')
    .select(
      'bank_name, bank_account_name, bank_account_number, qris_image_url, cod_enabled'
    )
    .eq('id', owner.storeId)
    .maybeSingle()
  if (error || !data) return { error: 'Gagal memuat data pembayaran.' }
  return { payment: data as StorePaymentData }
}

export async function saveStorePaymentAction(
  input: StorePaymentInput
): Promise<{ success: true } | { error: string }> {
  const validationError = validateStorePayment(input)
  if (validationError) return { error: validationError }

  const owner = await requireOwnerStoreId()
  if ('error' in owner) return { error: owner.error }

  const { error } = await owner.supabase
    .from('stores')
    .update({
      bank_name: input.bankName.trim() || null,
      bank_account_name: input.bankAccountName.trim() || null,
      bank_account_number: input.bankAccountNumber.trim() || null,
      qris_image_url: input.qrisImageUrl.trim() || null,
      cod_enabled: input.codEnabled,
    })
    .eq('id', owner.storeId)
  if (error) return { error: 'Gagal menyimpan pembayaran.' }
  return { success: true }
}
