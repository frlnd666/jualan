// Helper langganan (Fase 1, rencana SaaS Bab 3–6).
//
// Aturan yang ditegakkan di sini:
// - Toko tanpa baris subscriptions dianggap Free/ACTIVE (Bab 4).
// - Harga langganan: Silver Rp19.900/bulan, Gold Rp50.000/3 bulan.
// - Periode baru: Silver +1 bulan, Gold +3 bulan dari tanggal verifikasi.
// - Trial Silver 14 hari; masa tenggang PAST_DUE 7 hari.
//
// File ini HANYA membaca/menghitung. Penulisan (upgrade, verifikasi,
// pembatalan) ada di src/lib/actions/subscriptions.ts — semuanya lewat
// service_role, karena RLS sengaja tidak memberi pemilik toko hak
// mengubah subscriptions sendiri (lihat f1_subscriptions.sql).
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  effectiveTier,
  limitsFor,
  type SubscriptionRow,
  type SubscriptionStatus,
  type Tier,
  type TierLimits,
} from '@/lib/subscription-tiers'

export type { SubscriptionRow, SubscriptionStatus, Tier, TierLimits }
export { effectiveTier, limitsFor }

export const SILVER_PRICE = 19900
export const GOLD_PRICE = 50000

export const TIER_PRICES: Record<Exclude<Tier, 'free'>, number> = {
  silver: SILVER_PRICE,
  gold: GOLD_PRICE,
}

export const TIER_LABELS: Record<Tier, string> = {
  free: 'Free',
  silver: 'Silver',
  gold: 'Gold',
}

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  TRIALING: 'Masa percobaan',
  ACTIVE: 'Aktif',
  PAST_DUE: 'Telat bayar (masa tenggang)',
  EXPIRED: 'Berakhir (turun ke Free)',
  CANCELLED: 'Dibatalkan',
  SUSPENDED: 'Dibekukan admin',
}

/** Langganan Free default untuk toko yang belum punya baris subscriptions. */
export const FREE_SUBSCRIPTION: SubscriptionRow = {
  tier: 'free',
  status: 'ACTIVE',
  current_period_end: null,
}

/**
 * Baca langganan sebuah toko. `client` boleh client user (pemilik bisa
 * membaca subscriptions-nya sendiri lewat RLS) atau service_role.
 * - `error` dari database → THROW (bukan fallback diam-diam): pemanggil
 *   harus memutuskan sendiri — jalur uang menolak, tampilan fallback
 *   ke Free sambil mencatat kegagalan. Pesan DB hanya masuk log,
 *   bukan pesan ke user.
 * - `!data` (tidak ada baris) → FREE_SUBSCRIPTION: toko lama dari
 *   sebelum Fase 1 tetap jalan sebagai Free.
 */
export async function getStoreSubscription(
  client: SupabaseClient,
  storeId: string
): Promise<SubscriptionRow> {
  const { data, error } = await client
    .from('subscriptions')
    .select('tier, status, current_period_end')
    .eq('store_id', storeId)
    .maybeSingle()

  if (error) {
    console.error(
      '[getStoreSubscription] Gagal membaca langganan toko:',
      error.message
    )
    throw new Error('Gagal membaca langganan toko. Coba lagi.')
  }
  if (!data) return FREE_SUBSCRIPTION
  return {
    tier: (data as { tier: Tier }).tier,
    status: (data as { status: SubscriptionStatus }).status,
    current_period_end: (data as { current_period_end: string | null })
      .current_period_end,
  }
}

/** Akhir periode baru untuk tier berbayar, dihitung dari `from`. */
export function periodEndFor(tier: Exclude<Tier, 'free'>, from: Date): Date {
  const end = new Date(from)
  end.setMonth(end.getMonth() + (tier === 'silver' ? 1 : 3))
  return end
}

/** Metode pembayaran checkout yang diizinkan untuk tier efektif toko. */
export function allowedCheckoutMethods(
  row: SubscriptionRow,
  now: Date = new Date()
): Array<'BANK_TRANSFER' | 'QRIS' | 'COD'> {
  const { tier } = effectiveTier(row, now)
  if (row.status === 'SUSPENDED') return []
  if (tier === 'free') return ['COD']
  return ['BANK_TRANSFER', 'QRIS', 'COD']
}
