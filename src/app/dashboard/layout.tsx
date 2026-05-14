import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores')
    .select('id, name, slug')
    .eq('owner_id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <span className="font-bold text-gray-900 text-sm">
          {store ? store.name : 'UMKM Storefront'}
        </span>
        <div className="flex items-center gap-3">
          {store && (
            <Link
              href={`/${store.slug}`}
              className="text-xs text-indigo-600 font-medium"
              target="_blank"
            >
              Lihat Toko
            </Link>
          )}
        </div>
      </header>

      <div className="flex">
        <nav className="hidden md:flex flex-col w-56 bg-white border-r border-gray-100 min-h-screen px-3 py-4 gap-1">
          <NavLink href="/dashboard" label="Overview" />
          <NavLink href="/dashboard/products" label="Produk" />
          <NavLink href="/dashboard/orders" label="Pesanan" />
          <NavLink href="/dashboard/chat" label="Chat" />
          <NavLink href="/dashboard/settings" label="Pengaturan Toko" />
        </nav>

        <main className="flex-1 p-4 pb-24 md:pb-4">
          {children}
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-2 z-10">
        <MobileNavLink href="/dashboard" label="Home" />
        <MobileNavLink href="/dashboard/products" label="Produk" />
        <MobileNavLink href="/dashboard/orders" label="Pesanan" />
        <MobileNavLink href="/dashboard/chat" label="Chat" />
        <MobileNavLink href="/dashboard/settings" label="Toko" />
      </nav>
    </div>
  )
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition"
    >
      {label}
    </Link>
  )
}

function MobileNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-0.5 px-3 py-1 text-gray-500 hover:text-indigo-600 transition"
    >
      <span className="text-xs">{label}</span>
    </Link>
  )
}