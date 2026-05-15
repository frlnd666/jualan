import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')
  if (!slug) return NextResponse.json({ storeId: null })

  const supabase = await createClient()
  const { data } = await supabase.from('stores').select('id').eq('slug', slug).single()
  return NextResponse.json({ storeId: data?.id ?? null })
}