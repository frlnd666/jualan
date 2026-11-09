// Banner marketing toko — SERVER ACTIONS (Fase 4).
// Banner milik toko Silver/Gold (maks 1 slide AKTIF per toko). Toko Free
// TIDAK bisa membuat banner sendiri — storefront Free menampilkan slide
// iklan afiliasi platform (lihat AffiliateAdSlide), jadi banner sendiri
// adalah fitur paket berbayar, sama seperti flash sale.

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getOwnerStore, type DashboardStore } from '@/lib/dashboard-access'
import { getStoreSubscription, limitsFor } from '@/lib/subscriptions'

export interface StoreBannerRow {
  id: string
  store_id: string
  title: string
  image_url: string | null
  link_url: string | null
  is_active: boolean
  created_at: string
}

async function requireOwnerStore(): Promise<
  | { supabase: SupabaseClient; store: DashboardStore }
  | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' as const }
  const store = await getOwnerStore(supabase, user.id)
  if (!store) return { error: 'Toko tidak ditemukan untuk akun ini.' as const }
  return { supabase, store }
}

function canCreateBanner(
  flashSalesAllowed: boolean,
  premiumLocked: boolean
): boolean {
  // Banner marketing = fitur paket berbayar (sama seperti flash sale).
  return flashSalesAllowed && !premiumLocked
}

export async function listStoreBannersAction(): Promise<
  StoreBannerRow[] | { error: string }
> {
  const owner = await requireOwnerStore()
  if ('error' in owner) return { error: owner.error }
  const { supabase, store } = owner

  const { data, error } = await supabase
    .from('store_banners')
    .select('id, store_id, title, image_url, link_url, is_active, created_at')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
  if (error) {
    return { error: 'Banner belum tersedia — jalankan migrasi Fase 4 dulu.' }
  }
  return (data ?? []) as StoreBannerRow[]
}

export async function createStoreBannerAction(
  formData: FormData
): Promise<{ success?: string; error?: string }> {
  const owner = await requireOwnerStore()
  if ('error' in owner) return { error: owner.error }
  const { supabase, store } = owner

  // R-03: gagal baca langganan = fail-closed, terlihat oleh seller.
  let subscription
  try {
    subscription = await getStoreSubscription(supabase, store.id)
  } catch {
    return { error: 'Gagal memeriksa langganan toko. Coba lagi.' }
  }
  const limits = limitsFor(subscription)
  if (
    !canCreateBanner(limits.flashSales, subscription.status === 'PAST_DUE')
  ) {
    return {
      error:
        'Banner marketing hanya untuk paket Silver/Gold. Upgrade paketmu di halaman Langganan untuk memakai fitur ini.',
    }
  }

  const title = String(formData.get('title') ?? '').trim()
  const imageUrl = String(formData.get('imageUrl') ?? '').trim() || null
  const linkUrl = String(formData.get('linkUrl') ?? '').trim() || null
  if (!title) return { error: 'Teks banner wajib diisi.' }
  if (title.length > 120) return { error: 'Teks banner maksimal 120 karakter.' }
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    return { error: 'URL gambar harus diawali http:// atau https://.' }
  }
  if (linkUrl && !/^https?:\/\//i.test(linkUrl) && !linkUrl.startsWith('/')) {
    return { error: 'Tautan harus URL lengkap atau path internal (mis. /produk).' }
  }
  // P2-26: tolak protocol-relative '//evil.com' — regex di atas
  // meloloskannya sebagai path internal, padahal <Link> merendernya
  // sebagai tautan keluar ke domain asing.
  if (linkUrl?.startsWith('//')) {
    return { error: 'Tautan tidak boleh diawali //. Pakai URL lengkap (https://...) atau path internal (mis. /produk).' }
  }

  const { error } = await supabase.from('store_banners').insert({
    store_id: store.id,
    title,
    image_url: imageUrl,
    link_url: linkUrl,
    is_active: true,
  })
  if (error) {
    if (String(error.code) === '23505') {
      return {
        error:
          'Tokomu sudah punya banner aktif. Matikan dulu yang lama sebelum membuat yang baru.',
      }
    }
    return { error: 'Gagal membuat banner.' }
  }

  revalidatePath('/dashboard/banners')
  return { success: 'Banner dibuat.' }
}

export async function toggleStoreBannerAction(
  bannerId: string,
  isActive: boolean
): Promise<{ success?: string; error?: string }> {
  const owner = await requireOwnerStore()
  if ('error' in owner) return { error: owner.error }
  const { supabase, store } = owner

  const { error } = await supabase
    .from('store_banners')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', bannerId)
    .eq('store_id', store.id)
  if (error) {
    if (String(error.code) === '23505') {
      return {
        error: 'Tokomu sudah punya banner aktif lain. Matikan dulu yang lama.',
      }
    }
    return { error: 'Gagal mengubah status banner.' }
  }
  revalidatePath('/dashboard/banners')
  return { success: isActive ? 'Banner diaktifkan.' : 'Banner dinonaktifkan.' }
}

export async function deleteStoreBannerAction(
  bannerId: string
): Promise<{ success?: string; error?: string }> {
  const owner = await requireOwnerStore()
  if ('error' in owner) return { error: owner.error }
  const { supabase, store } = owner

  const { error } = await supabase
    .from('store_banners')
    .delete()
    .eq('id', bannerId)
    .eq('store_id', store.id)
  if (error) return { error: 'Gagal menghapus banner.' }
  revalidatePath('/dashboard/banners')
  return { success: 'Banner dihapus.' }
}
