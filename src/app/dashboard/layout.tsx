import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MobileBottomNav from '@/components/dashboard/mobile-bottom-nav'

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores')
    .select('id, name, slug')
    .eq('owner_id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[color:var(--surface)/0.92] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--text-muted)]">Dashboard</p>
            <span className="block truncate text-sm font-bold text-[var(--text)]">
              {store ? store.name : 'UMKM Storefront'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {store && (
              <Link
                href={`/${store.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center rounded-full border border-[var(--line)] bg-white px-4 text-xs font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] transition active:scale-[0.98]"
              >
                Lihat Toko
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-[calc(88px+env(safe-area-inset-bottom))] pt-4 md:pb-6">
        {children}
      </main>

      <MobileBottomNav />
    </div>
  )
}
