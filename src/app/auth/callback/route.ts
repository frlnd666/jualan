import { createClient } from '@/lib/supabase/server'
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
  // (mencegah open-redirect lewat parameter next).
  const safeNext =
    next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'

  return NextResponse.redirect(`${origin}${safeNext}`)
}
