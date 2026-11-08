import { describe, expect, it, vi } from 'vitest'
import { AUDIT_ACTION_LABELS } from '@/lib/audit'
import { logEvent, requiredEnvStatus } from '@/lib/observability'

describe('AUDIT_ACTION_LABELS', () => {
  it('semua aksi penting punya label Indonesia', () => {
    const actions = [
      'subscription_verified',
      'subscription_rejected',
      'subscription_cancelled',
      'store_suspended',
      'store_unsuspended',
      'staff_added',
      'staff_removed',
      'payment_confirmed',
      'price_changed',
    ] as const
    for (const action of actions) {
      expect(AUDIT_ACTION_LABELS[action]).toBeTruthy()
      expect(typeof AUDIT_ACTION_LABELS[action]).toBe('string')
    }
  })
})

describe('logEvent', () => {
  it('mengembalikan record JSON dengan ts + event, tanpa melempar', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const record = logEvent('order_created', {
      orderId: 'o1',
      total: 100000,
    })
    expect(record.event).toBe('order_created')
    expect(record.orderId).toBe('o1')
    expect(record.total).toBe(100000)
    expect(typeof record.ts).toBe('string')
    expect(spy).toHaveBeenCalledOnce()
    expect(() => JSON.parse(String(spy.mock.calls[0][0]))).not.toThrow()
    spy.mockRestore()
  })

  it('tidak mengandung nilai secret', () => {
    const record = logEvent('payment_confirmed', { orderId: 'o1' })
    expect(JSON.stringify(record)).not.toMatch(/secret|token|password/i)
  })
})

describe('requiredEnvStatus', () => {
  it('hanya boolean, bukan nilai', () => {
    const status = requiredEnvStatus()
    for (const value of Object.values(status)) {
      expect(typeof value).toBe('boolean')
    }
    expect('supabaseUrl' in status).toBe(true)
    expect('supabaseServiceRole' in status).toBe(true)
    expect('shopeepayEncryptionKey' in status).toBe(true)
  })
})
