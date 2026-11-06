import { describe, expect, it } from 'vitest'
import { checkRateLimit } from '@/lib/rate-limit'

describe('checkRateLimit', () => {
  it('mengizinkan sampai batas, lalu menolak', () => {
    const key = `test:${Math.random()}`
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true)
    }
    const blocked = checkRateLimit(key, 3, 60_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('kunci berbeda tidak saling memengaruhi', () => {
    const a = `a:${Math.random()}`
    const b = `b:${Math.random()}`
    checkRateLimit(a, 1, 60_000)
    expect(checkRateLimit(a, 1, 60_000).allowed).toBe(false)
    expect(checkRateLimit(b, 1, 60_000).allowed).toBe(true)
  })

  it('jendela yang sudah lewat mereset hitungan', () => {
    const key = `expired:${Math.random()}`
    checkRateLimit(key, 1, 1)
    // window 1ms — tunggu lewat lewat pemanggilan berikutnya setelah jeda kecil
    const start = Date.now()
    while (Date.now() - start < 3) {
      // busy wait 3ms
    }
    expect(checkRateLimit(key, 1, 1).allowed).toBe(true)
  })
})
