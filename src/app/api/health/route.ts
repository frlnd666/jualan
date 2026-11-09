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
  // P2-10: readiness hanya bergantung pada yang wajib (Supabase +
  // service role). ShopeePay dan rekening platform adalah fitur
  // opsional — tidak boleh membuat status jadi 'degraded'.
  const readinessOk =
    database === 'ok' && env.supabaseUrl && env.supabaseServiceRole
  const status = readinessOk ? 'ok' : 'degraded'

  return NextResponse.json({
    status,
    checks: {
      database,
      env,
      features: {
        shopeepay: env.shopeepayEncryptionKey,
        platformBank: env.platformBank,
      },
    },
    uptimeMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  })
}
