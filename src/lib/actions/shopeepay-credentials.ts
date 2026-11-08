// Kelola kredensial ShopeePay Partner per toko — SERVER ACTIONS.
// Owner-only (getOwnerStore). Secret + private key TIDAK PERNAH
// dikembalikan ke browser dalam bentuk asli — status hanya "terisi /
// belum", dan merchant ID ditampilkan tersamar. Simpan memakai
// enkripsi AES-256-GCM (lihat lib/shopeepay/crypto.ts); kunci platform
// SHOPEEPAY_ENCRYPTION_KEY wajib ada di env server sebelum menyimpan.

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOwnerStore } from '@/lib/dashboard-access'
import { encryptSecret, getEncryptionKey } from '@/lib/shopeepay/crypto'

export interface ShopeePayStatus {
  configured: boolean
  isActive: boolean
  /** Merchant ID tersamar (4 karakter terakhir) untuk tampilan. */
  merchantIdMasked: string | null
  /** Apakah kunci enkripsi platform sudah terpasang di server. */
  encryptionReady: boolean
}

function maskMerchantId(merchantId: string): string {
  const tail = merchantId.slice(-4)
  return `••••${tail}`
}

export async function getShopeePayStatusAction(): Promise<
  ShopeePayStatus | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const store = await getOwnerStore(supabase, user.id)
  if (!store) return { error: 'Toko tidak ditemukan untuk akun ini.' }

  let encryptionReady = true
  try {
    getEncryptionKey()
  } catch {
    encryptionReady = false
  }

  const { data } = await supabase
    .from('store_shopeepay_credentials')
    .select('merchant_id, is_active')
    .eq('store_id', store.id)
    .maybeSingle()

  if (!data) {
    return { configured: false, isActive: false, merchantIdMasked: null, encryptionReady }
  }
  const row = data as { merchant_id: string; is_active: boolean }
  return {
    configured: true,
    isActive: row.is_active === true,
    merchantIdMasked: maskMerchantId(row.merchant_id),
    encryptionReady,
  }
}

function isPemPrivateKey(value: string): boolean {
  return (
    value.includes('-----BEGIN PRIVATE KEY-----') ||
    value.includes('-----BEGIN RSA PRIVATE KEY-----')
  )
}

export async function saveShopeePayCredentialsAction(
  formData: FormData
): Promise<{ success?: string; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const store = await getOwnerStore(supabase, user.id)
  if (!store) return { error: 'Toko tidak ditemukan untuk akun ini.' }

  const clientId = String(formData.get('clientId') ?? '').trim()
  const clientSecret = String(formData.get('clientSecret') ?? '').trim()
  const privateKey = String(formData.get('privateKey') ?? '').trim()
  const merchantId = String(formData.get('merchantId') ?? '').trim()

  if (!clientId) return { error: 'Client ID wajib diisi.' }
  if (!clientSecret) return { error: 'Client Secret wajib diisi.' }
  if (!privateKey) return { error: 'Private Key wajib diisi.' }
  if (!isPemPrivateKey(privateKey)) {
    return {
      error:
        'Private Key harus format PEM (diawali -----BEGIN PRIVATE KEY-----). Salin persis dari file .pem ShopeePay.',
    }
  }
  if (!merchantId) return { error: 'Merchant ID wajib diisi.' }

  // Kunci enkripsi platform wajib ada — tanpa ini secret tidak bisa
  // disimpan aman. Pesan error-nya eksplisit supaya Ferlan tahu yang
  // harus diisi di Vercel (SHOPEEPAY_ENCRYPTION_KEY).
  try {
    getEncryptionKey()
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Kunci enkripsi belum diisi.' }
  }

  let clientSecretEnc: string
  let privateKeyEnc: string
  try {
    clientSecretEnc = encryptSecret(clientSecret)
    privateKeyEnc = encryptSecret(privateKey)
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Gagal mengenkripsi kredensial.',
    }
  }

  const { error } = await supabase
    .from('store_shopeepay_credentials')
    .upsert(
      {
        store_id: store.id,
        client_id: clientId,
        client_secret_enc: clientSecretEnc,
        private_key_enc: privateKeyEnc,
        merchant_id: merchantId,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'store_id' }
    )

  if (error) {
    return { error: 'Gagal menyimpan kredensial ShopeePay.' }
  }

  revalidatePath('/dashboard/settings')
  return { success: 'Kredensial ShopeePay tersimpan (terenkripsi). QRIS dinamis aktif untuk toko ini.' }
}

export async function setShopeePayActiveAction(
  isActive: boolean
): Promise<{ success?: string; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const store = await getOwnerStore(supabase, user.id)
  if (!store) return { error: 'Toko tidak ditemukan untuk akun ini.' }

  const { error } = await supabase
    .from('store_shopeepay_credentials')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('store_id', store.id)

  if (error) return { error: 'Gagal mengubah status QRIS dinamis.' }
  revalidatePath('/dashboard/settings')
  return {
    success: isActive
      ? 'QRIS dinamis diaktifkan.'
      : 'QRIS dinamis dimatikan — checkout QRIS kembali ke alur manual.',
  }
}

export async function deleteShopeePayCredentialsAction(): Promise<{
  success?: string
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const store = await getOwnerStore(supabase, user.id)
  if (!store) return { error: 'Toko tidak ditemukan untuk akun ini.' }

  const { error } = await supabase
    .from('store_shopeepay_credentials')
    .delete()
    .eq('store_id', store.id)

  if (error) return { error: 'Gagal menghapus kredensial ShopeePay.' }
  revalidatePath('/dashboard/settings')
  return { success: 'Kredensial ShopeePay dihapus. QRIS dinamis nonaktif.' }
}
