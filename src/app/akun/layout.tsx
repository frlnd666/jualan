// Layout akun pembeli (Fase 2): area /akun untuk pembeli login —
// riwayat pesanan, buku alamat, dan keranjang tersimpan. Terpisah dari
// /dashboard (penjual/staff/admin) supaya peran tidak tercampur.
import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/dashboard/LogoutButton'
import AkunNav from '@/components/akun/AkunNav'

export default async function AkunLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/akun')

  // Pastikan user punya baris profiles (role awal 'buyer') — sama
  // seperti layout dashboard. Gagal di sini tidak mematikan halaman.
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

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[color:var(--surface)/0.92] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--text-muted)]">
              Akun Pembeli
            </p>
            <span className="block truncate text-sm font-bold text-[var(--text)]">
              {user.email}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-full border border-[var(--line)] bg-white px-4 text-xs font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] transition active:scale-[0.98]"
            >
              Belanja
            </Link>
            <LogoutButton />
          </div>
        </div>
        <AkunNav />
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-[calc(88px+env(safe-area-inset-bottom))] pt-4 md:pb-6">
        {children}
      </main>
    </div>
  )
}
