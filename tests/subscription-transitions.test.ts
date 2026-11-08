import { describe, expect, it } from 'vitest'
import {
  decideTransition,
  reminderDue,
  wibDaysUntil,
  wibDayString,
  type TransitionRow,
} from '@/lib/subscription-transitions'

// "Sekarang" patokan tes: 2026-11-09 00:00 UTC = 07:00 WIB.
const NOW = new Date('2026-11-09T00:00:00Z')

function row(partial: Partial<TransitionRow>): TransitionRow {
  return {
    id: 'sub-1',
    store_id: 'store-1',
    tier: 'silver',
    status: 'ACTIVE',
    trial_ends_at: null,
    current_period_start: null,
    current_period_end: null,
    grace_ends_at: null,
    ...partial,
  }
}

describe('wibDaysUntil (hari kalender WIB, bukan 24 jam)', () => {
  it('deadline 2026-11-12 17:00 WIB dari 2026-11-09 07:00 WIB = 3 hari', () => {
    // 2026-11-12T10:00:00Z = 17:00 WIB; NOW = 07:00 WIB.
    expect(wibDaysUntil(NOW, new Date('2026-11-12T10:00:00Z'))).toBe(3)
  })

  it('batas hari WIB: 01:00 WIB vs 07:30 WIB di tanggal berbeda = 3 hari', () => {
    // now 2026-11-09 01:00 WIB (2026-11-08T18:00:00Z),
    // deadline 2026-11-12 07:30 WIB (2026-11-12T00:30:00Z).
    expect(
      wibDaysUntil(new Date('2026-11-08T18:00:00Z'), new Date('2026-11-12T00:30:00Z'))
    ).toBe(3)
  })

  it('hari yang sama = 0, kemarin = -1', () => {
    expect(wibDaysUntil(NOW, new Date('2026-11-09T10:00:00Z'))).toBe(0)
    expect(wibDaysUntil(NOW, new Date('2026-11-08T10:00:00Z'))).toBe(-1)
  })

  it('wibDayString memakai zona Asia/Jakarta', () => {
    expect(wibDayString(new Date('2026-11-09T00:00:00Z'))).toBe('2026-11-09')
    expect(wibDayString(new Date('2026-11-08T17:00:00Z'))).toBe('2026-11-09')
  })
})

describe('decideTransition — TRIALING', () => {
  it('trial habis → Free/ACTIVE, semua tanggal dibersihkan', () => {
    const d = decideTransition(
      row({
        status: 'TRIALING',
        trial_ends_at: '2026-11-08T12:00:00Z',
        current_period_start: '2026-10-26T12:00:00Z',
        current_period_end: '2026-11-08T12:00:00Z',
      }),
      NOW
    )
    expect(d?.kind).toBe('trial-ended')
    expect(d?.updates).toMatchObject({
      tier: 'free',
      status: 'ACTIVE',
      trial_ends_at: null,
      current_period_start: null,
      current_period_end: null,
      grace_ends_at: null,
    })
  })

  it('trial belum habis → null', () => {
    expect(
      decideTransition(
        row({ status: 'TRIALING', trial_ends_at: '2026-11-10T12:00:00Z' }),
        NOW
      )
    ).toBeNull()
  })

  it('trial tanpa tanggal → null (tidak bisa diputuskan)', () => {
    expect(decideTransition(row({ status: 'TRIALING' }), NOW)).toBeNull()
  })

  it('trial_ends_at kosong tapi current_period_end lewat → tetap berakhir', () => {
    const d = decideTransition(
      row({ status: 'TRIALING', current_period_end: '2026-11-08T12:00:00Z' }),
      NOW
    )
    expect(d?.kind).toBe('trial-ended')
  })
})

describe('decideTransition — ACTIVE berbayar', () => {
  it('periode habis → PAST_DUE + grace 7 hari dari akhir periode', () => {
    const d = decideTransition(
      row({ status: 'ACTIVE', current_period_end: '2026-11-08T12:00:00Z' }),
      NOW
    )
    expect(d?.kind).toBe('past-due')
    expect(d?.updates.status).toBe('PAST_DUE')
    expect(d?.updates.grace_ends_at).toBe('2026-11-15T12:00:00.000Z')
    expect(d?.updates.tier).toBeUndefined() // tier tetap silver
  })

  it('periode belum habis → null', () => {
    expect(
      decideTransition(
        row({ status: 'ACTIVE', current_period_end: '2026-12-08T12:00:00Z' }),
        NOW
      )
    ).toBeNull()
  })

  it('Free/ACTIVE tanpa periode → null', () => {
    expect(decideTransition(row({ tier: 'free', status: 'ACTIVE' }), NOW)).toBeNull()
  })
})

describe('decideTransition — PAST_DUE', () => {
  it('tenggang habis → EXPIRED + tier Free (periode disimpan sebagai riwayat)', () => {
    const d = decideTransition(
      row({
        status: 'PAST_DUE',
        current_period_end: '2026-11-01T12:00:00Z',
        grace_ends_at: '2026-11-08T12:00:00Z',
      }),
      NOW
    )
    expect(d?.kind).toBe('expired')
    expect(d?.updates).toMatchObject({ tier: 'free', status: 'EXPIRED' })
    expect(d?.updates.current_period_end).toBeUndefined()
  })

  it('grace_ends_at kosong → jatuh ke akhir periode + 7 hari', () => {
    // Periode berakhir 2026-11-01 → tenggang sampai 2026-11-08 → habis.
    const d = decideTransition(
      row({ status: 'PAST_DUE', current_period_end: '2026-11-01T12:00:00Z' }),
      NOW
    )
    expect(d?.kind).toBe('expired')
  })

  it('tenggang belum habis → null', () => {
    expect(
      decideTransition(
        row({
          status: 'PAST_DUE',
          current_period_end: '2026-11-05T12:00:00Z',
          grace_ends_at: '2026-11-12T12:00:00Z',
        }),
        NOW
      )
    ).toBeNull()
  })
})

describe('decideTransition — CANCELLED / SUSPENDED / EXPIRED', () => {
  it('CANCELLED habis periode → Free/ACTIVE', () => {
    const d = decideTransition(
      row({
        status: 'CANCELLED',
        tier: 'gold',
        current_period_end: '2026-11-08T12:00:00Z',
      }),
      NOW
    )
    expect(d?.kind).toBe('cancelled-ended')
    expect(d?.updates).toMatchObject({ tier: 'free', status: 'ACTIVE' })
  })

  it('CANCELLED belum habis periode → null (tier tetap sampai akhir)', () => {
    expect(
      decideTransition(
        row({ status: 'CANCELLED', current_period_end: '2026-12-08T12:00:00Z' }),
        NOW
      )
    ).toBeNull()
  })

  it('SUSPENDED tidak disentuh cron walau periode lewat', () => {
    expect(
      decideTransition(
        row({ status: 'SUSPENDED', current_period_end: '2026-11-01T12:00:00Z' }),
        NOW
      )
    ).toBeNull()
  })

  it('EXPIRED sudah terminal → null', () => {
    expect(
      decideTransition(
        row({ status: 'EXPIRED', tier: 'free', current_period_end: '2026-11-01T12:00:00Z' }),
        NOW
      )
    ).toBeNull()
  })
})

describe('decideTransition — idempotency (run kedua tidak mengubah apa-apa)', () => {
  it('sesudah trial-ended diterapkan, decide lagi → null', () => {
    const before = row({
      status: 'TRIALING',
      trial_ends_at: '2026-11-08T12:00:00Z',
      current_period_end: '2026-11-08T12:00:00Z',
    })
    const d = decideTransition(before, NOW)
    expect(d).not.toBeNull()
    const after = { ...before, ...d!.updates }
    expect(decideTransition(after, NOW)).toBeNull()
  })

  it('sesudah past-due diterapkan, decide lagi → null (tenggang masih jalan)', () => {
    const before = row({ status: 'ACTIVE', current_period_end: '2026-11-08T12:00:00Z' })
    const d = decideTransition(before, NOW)
    expect(d).not.toBeNull()
    const after = { ...before, ...d!.updates }
    expect(decideTransition(after, NOW)).toBeNull()
  })

  it('sesudah expired diterapkan, decide lagi → null', () => {
    const before = row({
      status: 'PAST_DUE',
      current_period_end: '2026-11-01T12:00:00Z',
      grace_ends_at: '2026-11-08T12:00:00Z',
    })
    const d = decideTransition(before, NOW)
    expect(d).not.toBeNull()
    const after = { ...before, ...d!.updates }
    expect(decideTransition(after, NOW)).toBeNull()
  })
})

describe('reminderDue — jendela H-3 / H-1', () => {
  it('trial H-3 → trial/3', () => {
    expect(
      reminderDue(
        row({ status: 'TRIALING', trial_ends_at: '2026-11-12T10:00:00Z' }),
        NOW
      )
    ).toEqual({ kind: 'trial', daysLeft: 3 })
  })

  it('trial H-1 → trial/1', () => {
    expect(
      reminderDue(
        row({ status: 'TRIALING', trial_ends_at: '2026-11-10T10:00:00Z' }),
        NOW
      )
    ).toEqual({ kind: 'trial', daysLeft: 1 })
  })

  it('periode berbayar H-3 → period/3, H-1 → period/1', () => {
    expect(
      reminderDue(
        row({ status: 'ACTIVE', current_period_end: '2026-11-12T10:00:00Z' }),
        NOW
      )
    ).toEqual({ kind: 'period', daysLeft: 3 })
    expect(
      reminderDue(
        row({ status: 'ACTIVE', current_period_end: '2026-11-10T10:00:00Z' }),
        NOW
      )
    ).toEqual({ kind: 'period', daysLeft: 1 })
  })

  it('H-2, H-0, dan sudah lewat → tidak ada pengingat', () => {
    const base = { status: 'TRIALING' as const }
    expect(
      reminderDue(row({ ...base, trial_ends_at: '2026-11-11T10:00:00Z' }), NOW)
    ).toBeNull()
    expect(
      reminderDue(row({ ...base, trial_ends_at: '2026-11-09T10:00:00Z' }), NOW)
    ).toBeNull()
    expect(
      reminderDue(row({ ...base, trial_ends_at: '2026-11-08T10:00:00Z' }), NOW)
    ).toBeNull()
  })

  it('Free, PAST_DUE, CANCELLED, SUSPENDED → tidak ada pengingat', () => {
    expect(
      reminderDue(
        row({ tier: 'free', status: 'ACTIVE', current_period_end: '2026-11-12T10:00:00Z' }),
        NOW
      )
    ).toBeNull()
    expect(
      reminderDue(
        row({
          status: 'PAST_DUE',
          current_period_end: '2026-11-01T12:00:00Z',
          grace_ends_at: '2026-11-12T12:00:00Z',
        }),
        NOW
      )
    ).toBeNull()
    expect(
      reminderDue(
        row({ status: 'CANCELLED', current_period_end: '2026-11-12T10:00:00Z' }),
        NOW
      )
    ).toBeNull()
    expect(
      reminderDue(
        row({ status: 'SUSPENDED', current_period_end: '2026-11-12T10:00:00Z' }),
        NOW
      )
    ).toBeNull()
  })
})
