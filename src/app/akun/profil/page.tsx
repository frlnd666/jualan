// Profil pembeli: data yang sudah ada saja — email + tanggal bergabung
// dari akun auth, ringkasan pesanan + alamat dari tabel yang ada.
// TIDAK ada kolom baru: tabel profiles hanya punya id/role/store_id/
// timestamps (tidak ada nama/no HP), jadi profil tidak menampilkan
// keduanya. Bila nanti butuh nama/no HP, perlu migrasi baru.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/dashboard/LogoutButton'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}

const profileLinks = [
  {
    href: '/akun/pesanan',
    title: 'Pesanan saya',
    desc: 'Riwayat dan status pesananmu',
  },
  {
    href: '/akun/alamat',
    title: 'Alamat saya',
    desc: 'Buku alamat untuk checkout',
  },
  {
    href: '/akun/notifikasi',
    title: 'Notifikasi',
    desc: 'Atur email & WhatsApp yang kamu terima',
  },
]

export default async function BuyerProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/akun/profil')

  const [{ count: orderCount }, { count: addressCount }] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', user.id),
    supabase
      .from('buyer_addresses')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', user.id),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <p className="text-sm font-medium text-[var(--text-muted)]">Akun Saya</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text)]">Profil</h1>
      </div>

      <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xl font-bold text-[var(--primary)]">
            {(user.email ?? '?')[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-[var(--text)]">
              {user.email}
            </p>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              Bergabung {formatDate(user.created_at)}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Pesanan
            </p>
            <p className="mt-1 text-xl font-bold text-[var(--text)]">
              {orderCount ?? 0}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Alamat tersimpan
            </p>
            <p className="mt-1 text-xl font-bold text-[var(--text)]">
              {addressCount ?? 0}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {profileLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center justify-between gap-3 rounded-3xl border border-[var(--line)] bg-[var(--surface)] px-5 py-4 shadow-[var(--shadow-sm)] transition hover:bg-[var(--surface-soft)]"
          >
            <span>
              <span className="block text-sm font-bold text-[var(--text)]">
                {link.title}
              </span>
              <span className="mt-0.5 block text-sm text-[var(--text-muted)]">
                {link.desc}
              </span>
            </span>
            <span aria-hidden="true" className="text-[var(--text-muted)]">
              →
            </span>
          </Link>
        ))}
      </section>

      <div className="flex items-center justify-between gap-3 rounded-3xl border border-[var(--line)] bg-[var(--surface)] px-5 py-4 shadow-[var(--shadow-sm)]">
        <div>
          <p className="text-sm font-bold text-[var(--text)]">Keluar dari akun</p>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            Kamu perlu masuk lagi untuk belanja dan lacak pesanan.
          </p>
        </div>
        <LogoutButton />
      </div>
    </div>
  )
}
