// Helper langganan untuk halaman publik (storefront).
//
// HANYA diimpor dari Server Component / Server Action — memakai
// service_role. Storefront publik (anon) tidak bisa membaca tabel
// subscriptions lewat RLS (policy hanya pemilik + admin), jadi tier
// toko dibaca lewat admin client. Bila service_role belum dikonfigurasi,
// toko dianggap Free (batas paling ketat) supaya tidak ada fitur
// berbayar yang bocor ke publik.
import { createAdminClient } from '@/lib/supabase/admin'
import { logEvent } from '@/lib/observability'
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
  try {
    return await getStoreSubscription(admin, storeId)
  } catch {
    // R-03: tampilan publik fallback ke tier paling ketat (tidak ada
    // fitur berbayar yang bocor), tapi kegagalan TERCATAT (bukan
    // diam-diam). Jalur uang (checkout) dilindungi terpisah dengan
    // menolak bila langganan tidak bisa dipastikan.
    logEvent('subscription_read_failed', { storeId })
    return FREE_SUBSCRIPTION
  }
}
