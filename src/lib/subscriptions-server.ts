// Helper langganan untuk halaman publik (storefront).
//
// HANYA diimpor dari Server Component / Server Action — memakai
// service_role. Storefront publik (anon) tidak bisa membaca tabel
// subscriptions lewat RLS (policy hanya pemilik + admin), jadi tier
// toko dibaca lewat admin client. Bila service_role belum dikonfigurasi,
// toko dianggap Free (batas paling ketat) supaya tidak ada fitur
// berbayar yang bocor ke publik.
import { createAdminClient } from '@/lib/supabase/admin'
import {
  FREE_SUBSCRIPTION,
  getStoreSubscription,
  type SubscriptionRow,
} from '@/lib/subscriptions'

export async function getPublicStoreSubscription(
  storeId: string
): Promise<SubscriptionRow> {
  const admin = createAdminClient()
  if (!admin) return FREE_SUBSCRIPTION
  return getStoreSubscription(admin, storeId)
}
