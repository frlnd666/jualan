// Flash sale per toko — SERVER ACTIONS (Fase 4).
// - CRUD flash sale: owner-only + tier-gated (Silver/Gold saja;
//   TIER_LIMITS.free.flashSales = false).
// - Harga promo dipakai checkout server-side (createOrderAction) —
//   validasi di sini hanya untuk pembuatan; penegakan harga di checkout
//   memakai lib/flash-sales.ts + tabel langsung.
// - Satu flash sale AKTIF per produk (unique index di migrasi f4);
//   duplikat = error 23505 yang diterjemahkan ke pesan ramah.

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getOwnerStore, type DashboardStore } from '@/lib/dashboard-access'
import { getStoreSubscription, limitsFor } from '@/lib/subscriptions'
import {
  canCreateFlashSale,
  type FlashSaleLike,
} from '@/lib/flash-sales'

export interface FlashSaleRow extends FlashSaleLike {
  product_name: string | null
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

export async function listFlashSalesAction(): Promise<
  FlashSaleRow[] | { error: string }
> {
  const owner = await requireOwnerStore()
  if ('error' in owner) return { error: owner.error }
  const { supabase, store } = owner

  const { data: sales, error } = await supabase
    .from('flash_sales')
    .select(
      'id, store_id, product_id, promo_price, starts_at, ends_at, is_active, created_at'
    )
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
  if (error) {
    // Tabel belum ada (migrasi f4 belum dijalankan) — bukan crash.
    return { error: 'Flash sale belum tersedia — jalankan migrasi Fase 4 dulu.' }
  }

  const productIds = [...new Set((sales ?? []).map((s) => s.product_id))]
  const names = new Map<string, string>()
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .in('id', productIds)
    for (const p of (products ?? []) as Array<{ id: string; name: string }>) {
      names.set(p.id, p.name)
    }
  }

  return ((sales ?? []) as FlashSaleLike[]).map((s) => ({
    ...s,
    promo_price: Number(s.promo_price),
    product_name: names.get(s.product_id) ?? null,
    created_at: (s as unknown as { created_at: string }).created_at,
  }))
}

export async function listStoreProductsForFlashSaleAction(): Promise<
  Array<{ id: string; name: string; price: number }> | { error: string }
> {
  const owner = await requireOwnerStore()
  if ('error' in owner) return { error: owner.error }
  const { supabase, store } = owner
  const { data, error } = await supabase
    .from('products')
    .select('id, name, price')
    .eq('store_id', store.id)
    .eq('available', true)
    .order('name', { ascending: true })
  if (error) return { error: 'Gagal memuat produk.' }
  return ((data ?? []) as Array<{ id: string; name: string; price: number }>).map(
    (p) => ({ ...p, price: Number(p.price) })
  )
}

export async function createFlashSaleAction(
  formData: FormData
): Promise<{ success?: string; error?: string }> {
  const owner = await requireOwnerStore()
  if ('error' in owner) return { error: owner.error }
  const { supabase, store } = owner

  // Tier gate: Free tidak boleh membuat flash sale; PAST_DUE mengunci
  // fitur premium baru (termasuk flash sale baru).
  const subscription = await getStoreSubscription(supabase, store.id)
  const limits = limitsFor(subscription)
  if (
    !canCreateFlashSale(
      limits.flashSales,
      subscription.status === 'PAST_DUE'
    )
  ) {
    return {
      error:
        'Flash sale hanya untuk paket Silver/Gold. Upgrade paketmu di halaman Langganan untuk memakai fitur ini.',
    }
  }

  const productId = String(formData.get('productId') ?? '').trim()
  const promoPrice = Math.floor(Number(formData.get('promoPrice') ?? 0))
  const startsAt = String(formData.get('startsAt') ?? '').trim()
  const endsAt = String(formData.get('endsAt') ?? '').trim()
  if (!productId) return { error: 'Pilih produk dulu.' }
  if (!Number.isFinite(promoPrice) || promoPrice <= 0) {
    return { error: 'Harga promo harus lebih dari 0.' }
  }
  if (!startsAt || !endsAt) {
    return { error: 'Tanggal mulai dan berakhir wajib diisi.' }
  }
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: 'Tanggal tidak valid.' }
  }
  if (end <= start) {
    return { error: 'Tanggal berakhir harus setelah tanggal mulai.' }
  }

  // Harga promo harus lebih murah dari harga normal produk.
  const { data: product } = await supabase
    .from('products')
    .select('id, name, price')
    .eq('id', productId)
    .eq('store_id', store.id)
    .maybeSingle()
  if (!product) return { error: 'Produk tidak ditemukan di tokomu.' }
  if (promoPrice >= Number((product as { price: number }).price)) {
    return { error: 'Harga promo harus lebih murah dari harga normal produk.' }
  }

  const { error } = await supabase.from('flash_sales').insert({
    store_id: store.id,
    product_id: productId,
    promo_price: promoPrice,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    is_active: true,
  })
  if (error) {
    if (String(error.code) === '23505') {
      return {
        error:
          'Produk ini sudah punya flash sale aktif. Matikan dulu yang lama sebelum membuat yang baru.',
      }
    }
    return { error: 'Gagal membuat flash sale.' }
  }

  revalidatePath('/dashboard/flash-sales')
  return { success: 'Flash sale dibuat.' }
}

export async function toggleFlashSaleAction(
  saleId: string,
  isActive: boolean
): Promise<{ success?: string; error?: string }> {
  const owner = await requireOwnerStore()
  if ('error' in owner) return { error: owner.error }
  const { supabase, store } = owner

  const { error } = await supabase
    .from('flash_sales')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', saleId)
    .eq('store_id', store.id)
  if (error) {
    if (String(error.code) === '23505') {
      return {
        error:
          'Produk ini sudah punya flash sale aktif lain. Matikan dulu yang lama.',
      }
    }
    return { error: 'Gagal mengubah status flash sale.' }
  }
  revalidatePath('/dashboard/flash-sales')
  return { success: isActive ? 'Flash sale diaktifkan.' : 'Flash sale dinonaktifkan.' }
}

export async function deleteFlashSaleAction(
  saleId: string
): Promise<{ success?: string; error?: string }> {
  const owner = await requireOwnerStore()
  if ('error' in owner) return { error: owner.error }
  const { supabase, store } = owner

  const { error } = await supabase
    .from('flash_sales')
    .delete()
    .eq('id', saleId)
    .eq('store_id', store.id)
  if (error) return { error: 'Gagal menghapus flash sale.' }
  revalidatePath('/dashboard/flash-sales')
  return { success: 'Flash sale dihapus.' }
}

/**
 * Flash sale aktif untuk storefront / halaman produk / checkout
 * (publik). Mengembalikan peta productId → promo. Bila tabel belum ada
 * (migrasi f4 belum dijalankan), kembalikan peta kosong — harga normal.
 */
export async function loadActiveFlashSalesForStore(
  supabase: SupabaseClient,
  storeId: string,
  now: Date = new Date()
): Promise<Map<string, number>> {
  const empty = new Map<string, number>()
  if (!storeId) return empty
  try {
    const { data, error } = await supabase
      .from('flash_sales')
      .select('product_id, promo_price, starts_at, ends_at, is_active')
      .eq('store_id', storeId)
      .eq('is_active', true)
    if (error || !data) return empty
    const map = new Map<string, number>()
    for (const row of data as FlashSaleLike[]) {
      const start = new Date(row.starts_at).getTime()
      const end = new Date(row.ends_at).getTime()
      if (Number.isNaN(start) || Number.isNaN(end)) continue
      const t = now.getTime()
      if (t < start || t > end) continue
      const promo = Math.max(0, Math.floor(Number(row.promo_price) || 0))
      if (promo > 0) map.set(row.product_id, promo)
    }
    return map
  } catch {
    return empty
  }
}
