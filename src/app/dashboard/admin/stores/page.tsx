// Daftar semua toko untuk admin platform: melengkapi detail toko di
// /dashboard/admin/stores/[id]. Sebelumnya route ini tidak ada (hanya
// halaman detail), sehingga menu "Toko" di navbar admin mengarah ke 404.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminUser } from '@/lib/admin-access'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}

export default async function AdminStoresPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const adminCheck = await requireAdminUser(supabase)
  if ('error' in adminCheck) {
    return (
      <div className="mx-auto max-w-xl space-y-4 pt-6">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
          Admin Platform
        </h1>
        <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-sm)]">
          <p className="text-base font-bold text-[var(--text)]">
            Halaman ini hanya untuk admin platform
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Akunmu tidak punya hak admin. Kembali ke dashboard tokomu.
          </p>
        </section>
      </div>
    )
  }

  const admin = createAdminClient()
  if (!admin) {
    return (
      <div className="mx-auto max-w-xl space-y-4 pt-6">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
          Toko
        </h1>
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          Konfigurasi server belum lengkap.
        </p>
      </div>
    )
  }

  const [{ data: storesData }, { data: subsData }] = await Promise.all([
    admin
      .from('stores')
      .select('id, name, slug, owner_id, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    admin.from('subscriptions').select('store_id, tier, status'),
  ])

  const stores = (storesData ?? []) as Array<{
    id: string
    name: string
    slug: string
    owner_id: string
    created_at: string
  }>
  const subs = (subsData ?? []) as Array<{
    store_id: string
    tier: string
    status: string
  }>
  const subByStore = new Map(subs.map((s) => [s.store_id, s]))

  // Email pemilik lewat Auth Admin API (dipetakan id → email).
  const emailByUserId = new Map<string, string>()
  try {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    for (const u of data.users) {
      if (u.id && u.email) emailByUserId.set(u.id, u.email)
    }
  } catch {}

  return (
    <div className="mx-auto max-w-4xl space-y-5 pt-6">
      <div>
        <p className="text-sm font-medium text-[var(--text-muted)]">
          Platform CUAN
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">
          Toko
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {stores.length} toko terdaftar
        </p>
      </div>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
        {stores.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Belum ada toko terdaftar.
          </p>
        ) : (
          <ul className="space-y-3">
            {stores.map((store) => {
              const sub = subByStore.get(store.id)
              return (
                <li key={store.id}>
                  <Link
                    href={`/dashboard/admin/stores/${store.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-soft)] px-4 py-3 transition active:scale-[0.99]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--text)]">
                        {store.name}
                      </p>
                      <p className="truncate text-xs text-[var(--text-muted)]">
                        {emailByUserId.get(store.owner_id) ?? store.owner_id} •{' '}
                        {formatDate(store.created_at)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--text)]">
                      {sub ? `${sub.tier} • ${sub.status}` : 'tanpa langganan'}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
