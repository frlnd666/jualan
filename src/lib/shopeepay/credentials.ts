// Muat + dekripsi kredensial ShopeePay toko — SERVER-ONLY.
// Dipakai generate QR (checkout / invoice) dan inquiry status.
// Mengembalikan null bila: toko belum mengisi kredensial, kredensial
// nonaktif, atau dekripsi gagal (mis. SHOPEEPAY_ENCRYPTION_KEY berubah).
// TIDAK PERNAH mengembalikan secret ke client — pemanggil di sini
// hanya server action / route handler.

import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptSecret } from '@/lib/shopeepay/crypto'
import type { ShopeePayCredentials } from '@/lib/shopeepay/snap'

export interface LoadedShopeePayCredentials extends ShopeePayCredentials {
  isActive: boolean
}

export async function loadDecryptedCredentials(
  supabase: SupabaseClient,
  storeId: string
): Promise<LoadedShopeePayCredentials | null> {
  try {
    const { data, error } = await supabase
      .from('store_shopeepay_credentials')
      .select('client_id, client_secret_enc, private_key_enc, merchant_id, is_active')
      .eq('store_id', storeId)
      .maybeSingle()

    if (error || !data) return null
    const row = data as {
      client_id: string
      client_secret_enc: string
      private_key_enc: string
      merchant_id: string
      is_active: boolean
    }
    return {
      clientId: row.client_id,
      clientSecret: decryptSecret(row.client_secret_enc),
      privateKeyPem: decryptSecret(row.private_key_enc),
      merchantId: row.merchant_id,
      isActive: row.is_active === true,
    }
  } catch {
    return null
  }
}
