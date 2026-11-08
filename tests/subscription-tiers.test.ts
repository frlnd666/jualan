import { describe, expect, it } from 'vitest'
import {
  effectiveTier,
  limitsFor,
  TIER_LIMITS,
  type SubscriptionRow,
} from '@/lib/subscription-tiers'
import { allowedCheckoutMethods } from '@/lib/subscriptions'

const now = new Date('2026-11-08T12:00:00Z')
const end = (iso: string) => iso

function row(
  partial: Partial<SubscriptionRow> & { tier: SubscriptionRow['tier'] }
): SubscriptionRow {
  return { status: 'ACTIVE', current_period_end: null, ...partial }
}

describe('TIER_LIMITS (Bab 3 — tabel tier terkunci)', () => {
  it('Free: 4 produk, 1 foto, 0 staff, tanpa voucher', () => {
    expect(TIER_LIMITS.free).toMatchObject({
      maxProducts: 4,
      maxPhotosPerProduct: 1,
      maxStaff: 0,
      vouchers: false,
      watermark: true,
      affiliateAds: true,
    })
  })

  it('Silver: 30 produk, 5 foto, 1 staff', () => {
    expect(TIER_LIMITS.silver).toMatchObject({
      maxProducts: 30,
      maxPhotosPerProduct: 5,
      maxStaff: 1,
      vouchers: true,
    })
  })

  it('Gold: 175 produk, 10 foto, 3 staff, ekspor + domain', () => {
    expect(TIER_LIMITS.gold).toMatchObject({
      maxProducts: 175,
      maxPhotosPerProduct: 10,
      maxStaff: 3,
      analyticsExport: true,
      customDomain: true,
    })
  })
})

describe('effectiveTier (Bab 4 — siklus hidup)', () => {
  it('TRIALING memakai tier Silver penuh', () => {
    const r = effectiveTier(row({ tier: 'silver', status: 'TRIALING' }), now)
    expect(r).toEqual({ tier: 'silver', premiumLocked: false })
  })

  it('ACTIVE memakai tier apa adanya', () => {
    expect(effectiveTier(row({ tier: 'gold' }), now).tier).toBe('gold')
    expect(effectiveTier(row({ tier: 'free' }), now).tier).toBe('free')
  })

  it('PAST_DUE mempertahankan tier tapi mengunci fitur premium baru', () => {
    const r = effectiveTier(
      row({ tier: 'silver', status: 'PAST_DUE' }),
      now
    )
    expect(r).toEqual({ tier: 'silver', premiumLocked: true })
  })

  it('EXPIRED turun ke Free', () => {
    const r = effectiveTier(row({ tier: 'gold', status: 'EXPIRED' }), now)
    expect(r).toEqual({ tier: 'free', premiumLocked: true })
  })

  it('CANCELLED tetap di tier sampai akhir periode, lalu Free', () => {
    const before = effectiveTier(
      row({
        tier: 'silver',
        status: 'CANCELLED',
        current_period_end: end('2026-12-08T12:00:00Z'),
      }),
      now
    )
    expect(before).toEqual({ tier: 'silver', premiumLocked: false })

    const after = effectiveTier(
      row({
        tier: 'silver',
        status: 'CANCELLED',
        current_period_end: end('2026-11-01T12:00:00Z'),
      }),
      now
    )
    expect(after).toEqual({ tier: 'free', premiumLocked: true })
  })
})

describe('limitsFor', () => {
  it('EXPIRED memakai batas Free (4 produk)', () => {
    expect(
      limitsFor(row({ tier: 'gold', status: 'EXPIRED' }), now).maxProducts
    ).toBe(4)
  })
})

describe('allowedCheckoutMethods (Bab 3 — Free hanya COD)', () => {
  it('Free hanya COD', () => {
    expect(allowedCheckoutMethods(row({ tier: 'free' }), now)).toEqual([
      'COD',
    ])
  })

  it('Silver/Gold boleh transfer, QRIS, dan COD', () => {
    expect(allowedCheckoutMethods(row({ tier: 'silver' }), now)).toEqual([
      'BANK_TRANSFER',
      'QRIS',
      'COD',
    ])
  })

  it('SUSPENDED tidak boleh checkout sama sekali', () => {
    expect(
      allowedCheckoutMethods(row({ tier: 'gold', status: 'SUSPENDED' }), now)
    ).toEqual([])
  })
})
