// Cron harian transisi status langganan —
// GET /api/cron/subscription-transitions (Vercel Cron, 07:00 WIB).
//
// Autentikasi: header `Authorization: Bearer <CRON_SECRET>` — Vercel
// Cron mengirim header ini OTOMATIS bila env CRON_SECRET diset di
// project (tidak perlu secret di URL/vercel.json). Header alternatif
// `x-cron-secret` diterima juga (pola yang sama seperti CEK PROMO).
// Tanpa secret yang benar → 401. Query param `?secret=` sengaja TIDAK
// diterima — secret di URL bisa bocor ke log.
//
// Route ini idempotent (lihat src/lib/subscription-transitions.ts) dan
// mengembalikan ringkasan {diproses, transisi, pengingat, error}.
// Vercel Hobby membunuh fungsi di 60 detik — satu run memproses
// seluruh langganan dalam batch query, jadi jauh di bawah batas itu
// untuk skala toko saat ini.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runSubscriptionTransitions } from '@/lib/subscription-transitions'

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

  const summary = await runSubscriptionTransitions(admin)
  return NextResponse.json({
    ok: true,
    processed: summary.processed,
    transitions: summary.transitions,
    reminders: summary.reminders,
    remindersSkippedDuplicate: summary.remindersSkippedDuplicate,
    errors: summary.errors,
  })
}
