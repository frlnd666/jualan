// Cron harian pembatalan order tak terbayar —
// GET /api/cron/order-expiry (Vercel Cron, 07:30 WIB).
//
// Autentikasi sama persis dengan cron transisi langganan:
// `Authorization: Bearer <CRON_SECRET>` (dikirim otomatis oleh Vercel
// Cron bila env diset) atau header `x-cron-secret`. Tanpa secret yang
// benar → 401; secret tidak pernah diterima lewat query param.
//
// Logika di src/lib/order-expiry.ts: order PENDING_PAYMENT lebih tua
// dari 24 jam dibatalkan + stok & kuota voucher dilepas, kecuali yang
// bukti bayarnya sedang menunggu verifikasi seller.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runOrderExpiry } from '@/lib/order-expiry'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  if (header === `Bearer ${secret}`) return true
  if (req.headers.get('x-cron-secret') === secret) return true
  return false
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: 'Unauthorized — CRON_SECRET tidak cocok atau belum diset.' },
      { status: 401 }
    )
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: 'Server belum dikonfigurasi (service role belum diset).' },
      { status: 500 }
    )
  }

  const summary = await runOrderExpiry(admin)
  return NextResponse.json({
    ok: true,
    processed: summary.processed,
    cancelled: summary.cancelled,
    skippedProofPending: summary.skippedProofPending,
    errors: summary.errors,
  })
}
