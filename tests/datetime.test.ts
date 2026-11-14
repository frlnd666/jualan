import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isoToLocalInput, localInputToIso } from '@/lib/datetime'

// Regresi bug zona waktu flash sale/voucher (14 Nov 2026): nilai
// datetime-local yang dikirim mentah dibaca server (UTC) sebagai UTC,
// sehingga jadwal penjual WIB bergeser +7 jam. Konversi harus terjadi
// di browser penjual — di sini disimulasikan dengan TZ Asia/Jakarta.
describe('datetime-local conversion (TZ Asia/Jakarta)', () => {
  const previousTz = process.env.TZ

  beforeAll(() => {
    process.env.TZ = 'Asia/Jakarta'
  })

  afterAll(() => {
    if (previousTz === undefined) delete process.env.TZ
    else process.env.TZ = previousTz
  })

  it('mengubah waktu dinding WIB menjadi instan UTC yang benar', () => {
    expect(localInputToIso('2026-11-14T19:00')).toBe('2026-11-14T12:00:00.000Z')
    expect(localInputToIso('2026-01-01T00:30')).toBe('2025-12-31T17:30:00.000Z')
  })

  it('round-trip: ISO hasil konversi tampil kembali sebagai waktu yang di-set', () => {
    expect(isoToLocalInput(localInputToIso('2026-11-14T19:00'))).toBe(
      '2026-11-14T19:00'
    )
    expect(isoToLocalInput('2026-11-14T12:00:00.000Z')).toBe('2026-11-14T19:00')
  })

  it('nilai kosong/invalid diteruskan apa adanya untuk divalidasi server', () => {
    expect(localInputToIso('')).toBe('')
    expect(localInputToIso('bukan-tanggal')).toBe('bukan-tanggal')
    expect(isoToLocalInput(null)).toBe('')
    expect(isoToLocalInput('bukan-tanggal')).toBe('')
  })
})
