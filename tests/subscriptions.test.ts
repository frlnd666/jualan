import { describe, expect, it } from 'vitest'
import {
  periodEndFor,
  resolvePlanIntent,
  isUniqueViolation,
  PENDING_PAYMENT_EXISTS_MESSAGE,
  TRIAL_ALREADY_USED_MESSAGE,
} from '@/lib/subscriptions'

// P2-22: akhir periode harus clamp ke hari terakhir bulan tujuan —
// Date.setMonth mentah meluber (31 Jan +1 bln = 3 Mar).
describe('periodEndFor (akhir bulan)', () => {
  it('Silver dari 31 Jan berakhir 28 Feb (bukan 3 Mar)', () => {
    const end = periodEndFor('silver', new Date(2026, 0, 31, 10, 30))
    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(1)
    expect(end.getDate()).toBe(28)
    expect(end.getHours()).toBe(10)
  })

  it('Silver dari 31 Jan tahun kabisat berakhir 29 Feb', () => {
    const end = periodEndFor('silver', new Date(2028, 0, 31))
    expect(end.getFullYear()).toBe(2028)
    expect(end.getMonth()).toBe(1)
    expect(end.getDate()).toBe(29)
  })

  it('Gold dari 31 Jan berakhir 30 Apr (bukan 1 Mei)', () => {
    const end = periodEndFor('gold', new Date(2026, 0, 31))
    expect(end.getMonth()).toBe(3)
    expect(end.getDate()).toBe(30)
  })

  it('Silver dari 30 Nov berakhir 30 Des (tidak kehilangan 1 hari)', () => {
    const end = periodEndFor('silver', new Date(2026, 10, 30))
    expect(end.getMonth()).toBe(11)
    expect(end.getDate()).toBe(30)
  })

  it('Tanggal biasa tidak berubah: 15 Mar +1 bln = 15 Apr', () => {
    const end = periodEndFor('silver', new Date(2026, 2, 15))
    expect(end.getMonth()).toBe(3)
    expect(end.getDate()).toBe(15)
  })
})

// P1-01: intent paket register diputuskan server-side dari allowlist +
// riwayat trial — nilai client (localStorage) yang dimanipulasi tidak
// boleh memberi apa pun di luar yang diizinkan.
describe('resolvePlanIntent (trial sekali per user)', () => {
  it('silver-trial pertama kali → TRIALING Silver', () => {
    expect(resolvePlanIntent('silver-trial', null)).toEqual({
      tier: 'silver',
      status: 'TRIALING',
      trialAlreadyUsed: false,
    })
  })

  it('silver-trial kedua (trial_used_at terisi) → Free/ACTIVE + flag', () => {
    expect(
      resolvePlanIntent('silver-trial', '2026-11-01T00:00:00.000Z')
    ).toEqual({
      tier: 'free',
      status: 'ACTIVE',
      trialAlreadyUsed: true,
    })
  })

  it('gold selalu dibuat Free (aktif hanya setelah verifikasi admin)', () => {
    expect(resolvePlanIntent('gold', null)).toEqual({
      tier: 'free',
      status: 'ACTIVE',
      trialAlreadyUsed: false,
    })
  })

  it('free → Free/ACTIVE tanpa flag', () => {
    expect(resolvePlanIntent('free', null)).toEqual({
      tier: 'free',
      status: 'ACTIVE',
      trialAlreadyUsed: false,
    })
  })

  it('intent tidak dikenal → Free/ACTIVE (bukan error, bukan trial)', () => {
    for (const plan of ['', 'silver', 'platinum', 'SILVER-TRIAL']) {
      expect(resolvePlanIntent(plan, null)).toEqual({
        tier: 'free',
        status: 'ACTIVE',
        trialAlreadyUsed: false,
      })
    }
  })

  it('pesan trial kedua menjelaskan toko tetap dibuat Free', () => {
    expect(TRIAL_ALREADY_USED_MESSAGE).toContain('paket Free')
    expect(TRIAL_ALREADY_USED_MESSAGE).toContain('sudah pernah dipakai')
  })
})

// P1-09: race pengajuan pending ganda dikenali dari kode 23505 supaya
// pesannya sama dengan cek pending (bukan error generik).
describe('isUniqueViolation (race 23505)', () => {
  it('kode 23505 → true', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true)
  })

  it('kode lain / tanpa kode / null → false', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false)
    expect(isUniqueViolation({})).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
    expect(isUniqueViolation(undefined)).toBe(false)
  })

  it('pesan pending sama persis dengan yang dipakai cek awal', () => {
    expect(PENDING_PAYMENT_EXISTS_MESSAGE).toContain(
      'menunggu verifikasi admin'
    )
  })
})
