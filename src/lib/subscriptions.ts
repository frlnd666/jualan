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

/**
 * P1-01: putuskan paket yang BOLEH dibuat untuk toko baru dari intent
 * register + riwayat trial pemilik. Fungsi murni (bisa di-unit-test).
 * - Intent tidak dikenal (mis. localStorage `cuan_plan` dimanipulasi)
 *   → 'free'.
 * - 'gold' selalu dibuat sebagai Free — Gold aktif hanya setelah
 *   pembayaran manual diverifikasi admin.
 * - 'silver-trial' hanya bila pemilik belum pernah memakai trial
 *   (profiles.trial_used_at null); bila sudah pernah → Free +
 *   trialAlreadyUsed, supaya pemanggil menampilkan pesan jelas.
 *   JANGAN andalkan trigger DB yang menurunkan diam-diam.
 */
export function resolvePlanIntent(
  plan: string,
  trialUsedAt: string | null
): {
  tier: 'free' | 'silver'
  status: 'ACTIVE' | 'TRIALING'
  trialAlreadyUsed: boolean
} {
  if (plan === 'silver-trial' && !trialUsedAt) {
    return { tier: 'silver', status: 'TRIALING', trialAlreadyUsed: false }
  }
  return {
    tier: 'free',
    status: 'ACTIVE',
    trialAlreadyUsed: plan === 'silver-trial',
  }
}

/** P1-01: pesan saat trial kedua ditolak — toko tetap dibuat sebagai Free. */
export const TRIAL_ALREADY_USED_MESSAGE =
  'Toko tersimpan dengan paket Free — trial Silver sudah pernah dipakai akun ini, jadi tidak bisa dipakai lagi. Upgrade ke Silver atau Gold dari halaman Langganan.'

/**
 * P1-09: pesan antrean pending ganda — dipakai cek awal DAN tangkapan
 * race 23505 di submitSubscriptionPayment, supaya pesannya sama persis.
 */
export const PENDING_PAYMENT_EXISTS_MESSAGE =
  'Masih ada pembayaran langganan yang menunggu verifikasi admin. Tunggu hasilnya dulu sebelum mengajukan lagi.'

/** P1-09: pelanggaran unique index (Postgrest error code 23505). */
export function isUniqueViolation(
  error: { code?: string } | null | undefined
): boolean {
  return error?.code === '23505'
}

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
    .select('tier, status, current_period_end, trial_ends_at, grace_ends_at')
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
  const row = data as {
    tier: Tier
    status: SubscriptionStatus
    current_period_end: string | null
    trial_ends_at: string | null
    grace_ends_at: string | null
  }
  return {
    tier: row.tier,
    status: row.status,
    current_period_end: row.current_period_end,
    trial_ends_at: row.trial_ends_at,
    grace_ends_at: row.grace_ends_at,
  }
}

/** Akhir periode baru untuk tier berbayar, dihitung dari `from`. */
export function periodEndFor(tier: Exclude<Tier, 'free'>, from: Date): Date {
  // P2-22: Date.setMonth meluber di akhir bulan (31 Jan +1 bln = 3 Mar)
  // — clamp ke hari terakhir bulan tujuan (31 Jan +1 bln = 28/29 Feb,
  // 31 Jan +3 bln = 30 Apr). Set tanggal ke 1 dulu supaya setMonth
  // tidak meluber sebelum clamp; jam/menit/detik ikut `from`.
  const months = tier === 'silver' ? 1 : 3
  const day = from.getDate()
  const end = new Date(from)
  end.setDate(1)
  end.setMonth(end.getMonth() + months)
  const daysInTargetMonth = new Date(
    end.getFullYear(),
    end.getMonth() + 1,
    0
  ).getDate()
  end.setDate(Math.min(day, daysInTargetMonth))
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
