// Health check sederhana (Fase 4 — observability).
// GET /api/health → status database + env wajib (HANYA boolean —
// nilai secret TIDAK PERNAH dikembalikan). Tanpa auth: responsnya
// tidak berisi data sensitif apa pun.

import { NextResponse } from 'next/server'
import { createPublicInvoiceClient } from '@/lib/invoice-access'
import { requiredEnvStatus } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = Date.now()
  let database: 'ok' | 'fail' = 'fail'
  try {
    const supabase = await createPublicInvoiceClient()
    const { error } = await supabase
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .limit(1)
    if (!error) database = 'ok'
  } catch {
    database = 'fail'
  }

  const env = requiredEnvStatus()
  const envOk =
    env.supabaseUrl && env.supabaseServiceRole && env.shopeePayEncryptionKey
  const status = database === 'ok' && envOk ? 'ok' : 'degraded'

  return NextResponse.json({
    status,
    checks: {
      database,
      env,
    },
    uptimeMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  })
}
