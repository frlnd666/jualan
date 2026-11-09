import { describe, expect, it } from 'vitest'
import {
  paginate,
  paymentStatusLabel,
  paymentStatusPillClass,
  subscriptionStatusPillClass,
  tierPillClass,
} from '@/lib/admin-ui'

describe('paginate', () => {
  it('halaman pertama dari daftar panjang', () => {
    expect(paginate(55, 1, 20)).toEqual({
      page: 1,
      pageCount: 3,
      total: 55,
      from: 0,
      to: 19,
    })
  })
  it('halaman terakhir parsial', () => {
    const p = paginate(55, 3, 20)
    expect(p.from).toBe(40)
    expect(p.to).toBe(54)
  })
  it('halaman di luar rentang diklem ke terakhir', () => {
    expect(paginate(55, 99, 20).page).toBe(3)
  })
  it('input halaman rusak jatuh ke 1', () => {
    expect(paginate(55, 'abc', 20).page).toBe(1)
    expect(paginate(55, undefined, 20).page).toBe(1)
    expect(paginate(55, 0, 20).page).toBe(1)
  })
  it('total 0 tetap satu halaman kosong', () => {
    const p = paginate(0, 5, 20)
    expect(p.page).toBe(1)
    expect(p.pageCount).toBe(1)
    expect(p.total).toBe(0)
  })
})

describe('label & pill admin', () => {
  it('status pembayaran dikenal', () => {
    expect(paymentStatusLabel('PENDING_VERIFICATION')).toBe(
      'Menunggu verifikasi'
    )
    expect(paymentStatusLabel('VERIFIED')).toBe('Terverifikasi')
    expect(paymentStatusLabel('REJECTED')).toBe('Ditolak')
    expect(paymentStatusLabel('ANEH')).toBe('ANEH')
  })
  it('kelas pill tidak kosong untuk status dikenal', () => {
    for (const s of ['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED']) {
      expect(paymentStatusPillClass(s)).toContain('bg-')
    }
    for (const s of ['ACTIVE', 'TRIALING', 'PAST_DUE', 'SUSPENDED']) {
      expect(subscriptionStatusPillClass(s)).toContain('bg-')
    }
    expect(tierPillClass('gold')).toContain('yellow')
    expect(tierPillClass('silver')).toContain('slate')
  })
})
