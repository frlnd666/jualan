// Batas tier + status langganan (rencana SaaS Bab 3–5).
// Dipakai penegakan batas di server (Fase 1). Fungsi di file ini murni
// (tidak menyentuh database) supaya gampang dites; pemanggilan ke tabel
// subscriptions dilakukan di server action yang memakainya.

export type Tier = 'free' | 'silver' | 'gold'

export type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'SUSPENDED'

export interface TierLimits {
  maxProducts: number
  maxPhotosPerProduct: number
  maxStaff: number
  watermark: boolean
  affiliateAds: boolean
  vouchers: boolean
  flashSales: boolean
  analyticsExport: boolean
  customDomain: boolean
}

// Bab 3 — tabel tier final yang sudah dikunci.
export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    maxProducts: 4,
    maxPhotosPerProduct: 1,
    maxStaff: 0,
    watermark: true,
    affiliateAds: true,
    vouchers: false,
    flashSales: false,
    analyticsExport: false,
    customDomain: false,
  },
  silver: {
    maxProducts: 30,
    maxPhotosPerProduct: 5,
    maxStaff: 1,
    watermark: false,
    affiliateAds: false,
    vouchers: true,
    flashSales: true,
    analyticsExport: false,
    customDomain: false,
  },
  gold: {
    maxProducts: 175,
    maxPhotosPerProduct: 10,
    maxStaff: 3,
    watermark: false,
    affiliateAds: false,
    vouchers: true,
    flashSales: true,
    analyticsExport: true,
    customDomain: true,
  },
}

export const TRIAL_DAYS = 14
export const GRACE_DAYS = 7

export interface SubscriptionRow {
  tier: Tier
  status: SubscriptionStatus
  current_period_end: string | null
}

/**
 * Tier efektif sebuah toko pada saat `now` (Bab 4–5).
 * - TRIALING: fitur penuh Silver selama trial berjalan.
 * - PAST_DUE: tier tetap, tapi fitur premium BARU dikunci
 *   (premiumLocked = true); toko tetap bisa jualan.
 * - EXPIRED: turun ke Free (produk di atas batas disembunyikan,
 *   bukan dihapus — itu urusan tampilan, bukan fungsi ini).
 * - CANCELLED: tier tetap sampai akhir periode berbayar, lalu Free.
 * - SUSPENDED: tier tetap, tapi toko mati (ditangani di tempat lain).
 * - ACTIVE: tier apa adanya.
 */
export function effectiveTier(
  row: SubscriptionRow,
  now: Date = new Date()
): { tier: Tier; premiumLocked: boolean } {
  if (row.status === 'EXPIRED') return { tier: 'free', premiumLocked: true }
  if (row.status === 'PAST_DUE') return { tier: row.tier, premiumLocked: true }
  if (row.status === 'CANCELLED') {
    const end = row.current_period_end ? new Date(row.current_period_end) : null
    if (end && now >= end) return { tier: 'free', premiumLocked: true }
    return { tier: row.tier, premiumLocked: false }
  }
  return { tier: row.tier, premiumLocked: false }
}

export function limitsFor(row: SubscriptionRow, now: Date = new Date()): TierLimits {
  return TIER_LIMITS[effectiveTier(row, now).tier]
}
