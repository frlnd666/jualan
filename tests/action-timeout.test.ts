// Diagnostik sementara 2026-11-09 — lihat src/lib/action-timeout.ts.
// Hapus file ini bersama helpernya setelah akar masalah ketemu.
import { describe, expect, it } from 'vitest'
import {
  createStepTracker,
  withActionTimeout,
} from '@/lib/action-timeout'

describe('action-timeout', () => {
  it('mengembalikan nilai promise yang selesai tepat waktu', async () => {
    const tracker = createStepTracker()
    const result = await withActionTimeout(
      Promise.resolve('ok'),
      1000,
      tracker
    )
    expect(result).toBe('ok')
  })

  it('menolak dengan pesan yang menyebut langkah terakhir saat timeout', async () => {
    const tracker = createStepTracker()
    tracker.set('update orders.seller_note')
    const never = new Promise<string>(() => {})
    await expect(
      withActionTimeout(never, 10, tracker)
    ).rejects.toThrow('update orders.seller_note')
  })

  it('tracker mencatat langkah dan waktu berlalu', () => {
    const tracker = createStepTracker()
    expect(tracker.step).toBe('mulai')
    tracker.set('auth.getUser')
    expect(tracker.step).toBe('auth.getUser')
    expect(tracker.elapsedMs()).toBeGreaterThanOrEqual(0)
  })
})
