import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MobileBottomNav from '@/components/dashboard/mobile-bottom-nav'
import DesktopNav from '@/components/dashboard/DesktopNav'
import LogoutButton from '@/components/dashboard/LogoutButton'
import { getDashboardAccess } from '@/lib/dashboard-access'

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

  // Fase 1: pastikan user punya baris profiles (role awal 'buyer').
  // RLS mengizinkan user menyisipkan barisnya sendiri sebagai buyer.
  // Gagal di sini tidak boleh mematikan dashboard — dicoba diam-diam.
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile) {
      await supabase.from('profiles').insert({ id: user.id, role: 'buyer' })
    }
  } catch {}

  // Fase 2: staff masuk dashboard toko tempatnya bekerja (bukan toko
  // miliknya) — header menampilkan nama toko itu, nav difilter.
  const access = await getDashboardAccess(supabase, user.id)
  const store = access?.store ?? null
  const isStaff = access?.role === 'staff'
  const { data: isAdmin } = await supabase.rpc('is_admin')

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
            <LogoutButton />
          </div>
        </div>
        <DesktopNav isStaff={isStaff} isAdmin={isAdmin === true} />
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-[calc(88px+env(safe-area-inset-bottom))] pt-4 md:pb-6">
        {children}
      </main>

      <MobileBottomNav isStaff={isStaff} isAdmin={isAdmin === true} />
    </div>
  )
}
