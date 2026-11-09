import { createClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/safe-next'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Hanya izinkan redirect ke path relatif di origin yang sama
  // (mencegah open-redirect lewat parameter next). Validasi terpusat
  // di lib/safe-next.ts — dipakai juga halaman register/login.
  const safeNext = safeNextPath(next, '/dashboard')

  return NextResponse.redirect(`${origin}${safeNext}`)
}
