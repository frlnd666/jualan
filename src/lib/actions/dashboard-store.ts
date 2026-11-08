// Info toko untuk halaman dashboard client-side (Fase 2, 'use server').
//
// Halaman tambah/edit produk berjalan di browser dan tidak bisa membaca
// tabel stores langsung: staff tidak punya policy select di stores
// (sengaja — baris stores berisi rekening bank toko). Action ini
// memverifikasi akses dulu lewat getDashboardAccess (pemilik ATAU
// staff), lalu membaca data lewat service_role dan hanya mengembalikan
// kolom yang aman ditampilkan: id toko, label paket, dan kuota produk.
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDashboardAccess } from '@/lib/dashboard-access'
import { getStoreSubscription } from '@/lib/subscriptions'
import { effectiveTier, limitsFor } from '@/lib/subscription-tiers'

export async function getProductQuotaAction(): Promise<
  | {
      storeId: string
      storeName: string
      tierLabel: string
      productLimit: number
      productUsed: number
    }
  | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const access = await getDashboardAccess(supabase, user.id)
  if (!access) return { error: 'Toko tidak ditemukan untuk akun ini.' }

  const admin = createAdminClient()
  if (!admin) return { error: 'Konfigurasi server belum lengkap.' }
  const subscription = await getStoreSubscription(admin, access.store.id)
  const { tier } = effectiveTier(subscription)
  const tierLabel = tier === 'free' ? 'Free' : tier === 'silver' ? 'Silver' : 'Gold'

  const { count } = await admin
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', access.store.id)

  return {
    storeId: access.store.id,
    storeName: access.store.name,
    tierLabel,
    productLimit: limitsFor(subscription).maxProducts,
    productUsed: count ?? 0,
  }
}

export type ProductForEdit = {
  id: string
  store_id: string
  name: string
  slug: string
  price: number | string
  stock: number | null
  description: string | null
  available: boolean
  images: string[] | null
  weight_gram?: number | null
}

export async function getProductForEditAction(
  productId: string
): Promise<{ product: ProductForEdit } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login untuk mengelola produk.' }

  const access = await getDashboardAccess(supabase, user.id)
  if (!access) return { error: 'Toko tidak ditemukan untuk akun ini.' }

  const admin = createAdminClient()
  if (!admin) return { error: 'Konfigurasi server belum lengkap.' }
  const { data: product, error } = await admin
    .from('products')
    .select('id, store_id, name, slug, price, stock, description, available, images, weight_gram')
    .eq('id', productId)
    .eq('store_id', access.store.id)
    .maybeSingle()
  if (error || !product) return { error: 'Produk tidak ditemukan.' }
  return { product: product as ProductForEdit }
}
