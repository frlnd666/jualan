import { describe, expect, it } from 'vitest'
import {
  buildAnalyticsCsv,
  canExportAnalytics,
  computeAnalytics,
  computePeriodTotals,
  deltaPct,
  previousRangeWindow,
  rangeStart,
  type AnalyticsInvoiceRow,
  type AnalyticsItemRow,
  type AnalyticsOrderRow,
} from '@/lib/analytics'

const NOW = new Date('2026-11-10T12:00:00.000Z')

function orders(): AnalyticsOrderRow[] {
  return [
    { id: 'o1', total: 100000, status: 'PAID', created_at: '2026-11-09T10:00:00.000Z' },
    { id: 'o2', total: 50000, status: 'SHIPPED', created_at: '2026-11-09T15:00:00.000Z' },
    { id: 'o3', total: 200000, status: 'CANCELLED', created_at: '2026-11-08T09:00:00.000Z' },
    { id: 'o4', total: 75000, status: 'PENDING_PAYMENT', created_at: '2026-11-10T08:00:00.000Z' },
  ]
}

function items(): AnalyticsItemRow[] {
  return [
    { order_id: 'o1', product_name: 'Kopi Gula Aren', qty: 2, price: 25000, subtotal: 50000 },
    { order_id: 'o1', product_name: 'Roti Bakar', qty: 1, price: 50000, subtotal: 50000 },
    { order_id: 'o2', product_name: 'Kopi Gula Aren', qty: 2, price: 25000, subtotal: 50000 },
    { order_id: 'o3', product_name: 'Kopi Gula Aren', qty: 8, price: 25000, subtotal: 200000 },
  ]
}

function invoices(): AnalyticsInvoiceRow[] {
  return [
    { order_id: 'o1', payment_status: 'PAID' },
    { order_id: 'o2', payment_status: 'PENDING_PAYMENT' },
    { order_id: 'o3', payment_status: 'PENDING_PAYMENT' },
    { order_id: 'o4', payment_status: 'PENDING_PAYMENT' },
  ]
}

describe('computeAnalytics', () => {
  it('GMV mengecualikan order batal; lunas hanya invoice PAID', () => {
    const s = computeAnalytics(orders(), items(), invoices(), '30d', NOW)
    expect(s.gmv).toBe(225000)
    expect(s.paidRevenue).toBe(100000)
    expect(s.orderCount).toBe(3)
    expect(s.paidOrderCount).toBe(1)
    expect(s.cancelledCount).toBe(1)
    expect(s.avgOrderValue).toBe(75000)
    expect(s.byStatus.PAID).toBe(1)
    expect(s.byStatus.CANCELLED).toBe(1)
  })

  it('produk terlaris mengecualikan item order batal', () => {
    const s = computeAnalytics(orders(), items(), invoices(), '30d', NOW)
    expect(s.topProducts[0]).toEqual({
      name: 'Kopi Gula Aren',
      qty: 4,
      revenue: 100000,
    })
    expect(s.topProducts[1].name).toBe('Roti Bakar')
  })

  it('kosong bila tidak ada order', () => {
    const s = computeAnalytics([], [], [], '7d', NOW)
    expect(s.gmv).toBe(0)
    expect(s.orderCount).toBe(0)
    expect(s.avgOrderValue).toBe(0)
    expect(s.topProducts).toEqual([])
  })
})

describe('rangeStart', () => {
  it('7d = 7 hari ke belakang', () => {
    expect(rangeStart('7d', NOW)?.toISOString()).toBe('2026-11-03T12:00:00.000Z')
  })
  it('all = null', () => {
    expect(rangeStart('all', NOW)).toBeNull()
  })
})

describe('canExportAnalytics', () => {
  it('hanya Gold (dan tidak terkunci)', () => {
    expect(canExportAnalytics(true, false)).toBe(true)
    expect(canExportAnalytics(false, false)).toBe(false)
    expect(canExportAnalytics(true, true)).toBe(false)
  })
})

describe('buildAnalyticsCsv', () => {
  it('berisi header harian + produk terlaris + BOM', () => {
    const s = computeAnalytics(orders(), items(), invoices(), '30d', NOW)
    const { filename, csv } = buildAnalyticsCsv(s, '30 hari terakhir', 'toko-ibel')
    expect(filename).toMatch(/^analitik-toko-ibel-/)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('Tanggal,Jumlah Order,GMV (Rp),Lunas (Rp)')
    expect(csv).toContain('Kopi Gula Aren,4,100000')
    expect(csv).toContain('Total GMV (Rp),225000')
  })
})

describe('previousRangeWindow', () => {
  it('7d = 14 hari lalu sampai 7 hari lalu', () => {
    const w = previousRangeWindow('7d', NOW)
    expect(w?.start.toISOString()).toBe('2026-10-27T12:00:00.000Z')
    expect(w?.end.toISOString()).toBe('2026-11-03T12:00:00.000Z')
  })
  it('30d = 60 hari lalu sampai 30 hari lalu', () => {
    const w = previousRangeWindow('30d', NOW)
    expect(w?.start.toISOString()).toBe('2026-09-11T12:00:00.000Z')
    expect(w?.end.toISOString()).toBe('2026-10-11T12:00:00.000Z')
  })
  it('all = null (tidak ada pembanding)', () => {
    expect(previousRangeWindow('all', NOW)).toBeNull()
  })
})

describe('computePeriodTotals', () => {
  it('aturan yang sama seperti computeAnalytics (tanpa daily/top)', () => {
    const t = computePeriodTotals(orders(), invoices())
    expect(t.gmv).toBe(225000)
    expect(t.paidRevenue).toBe(100000)
    expect(t.orderCount).toBe(3)
    expect(t.avgOrderValue).toBe(75000)
  })
  it('periode kosong = semua 0', () => {
    expect(computePeriodTotals([], [])).toEqual({
      gmv: 0,
      paidRevenue: 0,
      orderCount: 0,
      avgOrderValue: 0,
    })
  })
})

describe('deltaPct', () => {
  it('naik dan turun', () => {
    expect(deltaPct(150, 100)).toBe(50)
    expect(deltaPct(75, 100)).toBe(-25)
    expect(deltaPct(100, 100)).toBe(0)
  })
  it('previous 0: 0 → 0 = 0, 0 → ada penjualan = null', () => {
    expect(deltaPct(0, 0)).toBe(0)
    expect(deltaPct(50000, 0)).toBeNull()
  })
})
