import { describe, expect, it } from 'vitest'

import { csvEscape } from '@/lib/csv'

describe('csvEscape', () => {
  it('nilai biasa lolos apa adanya', () => {
    expect(csvEscape('Budi Santoso')).toBe('Budi Santoso')
    expect(csvEscape(150000)).toBe('150000')
    expect(csvEscape(null)).toBe('')
    expect(csvEscape(undefined)).toBe('')
  })

  it('sel berisi koma/kutip/newline di-quote per RFC 4180', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('dia "bilang" hai')).toBe('"dia ""bilang"" hai"')
    expect(csvEscape('baris\nbaru')).toBe('"baris\nbaru"')
  })

  it('formula injection dinetralkan dengan prefix apostrof', () => {
    expect(csvEscape('=HYPERLINK("http://jahat")')).toBe(
      `"'=HYPERLINK(""http://jahat"")"`
    )
    expect(csvEscape('+2+2')).toBe("'+2+2")
    expect(csvEscape('-2+2')).toBe("'-2+2")
    expect(csvEscape('@SUM(1+1)')).toBe("'@SUM(1+1)")
    expect(csvEscape('\t=cmd')).toBe("'\t=cmd")
  })

  it('nilai number tidak diprefix (kolom uang tetap numerik)', () => {
    expect(csvEscape(-500)).toBe('-500')
  })
})
