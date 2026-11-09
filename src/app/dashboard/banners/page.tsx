// Halaman kelola banner marketing toko (Fase 4) — owner-only.
// Maks 1 slide aktif. Banner milik toko Silver/Gold; toko Free
// menampilkan slide iklan afiliasi platform di storefront.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOwnerStore } from '@/lib/dashboard-access'
import { logEvent } from '@/lib/observability'
import {
  FREE_SUBSCRIPTION,
  getStoreSubscription,
  limitsFor,
  TIER_LABELS,
} from '@/lib/subscriptions'
import { listStoreBannersAction } from '@/lib/actions/store-banners'
import StaffDeniedCard from '@/components/dashboard/StaffDeniedCard'
import BannerForm from '@/components/dashboard/BannerForm'
import BannerActions from '@/components/dashboard/BannerActions'

export default async function BannersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const store = await getOwnerStore(supabase, user.id)
  if (!store) {
    return <StaffDeniedCard title="Banner Toko" />
  }

  // R-03: tampilan fallback ke tier paling ketat (Free) bila langganan
  // gagal dibaca, tapi kegagalan TERCATAT lewat logEvent (bukan diam-diam).
  let subscription = FREE_SUBSCRIPTION
  try {
    subscription = await getStoreSubscription(supabase, store.id)
  } catch {
    logEvent('subscription_read_failed', { storeId: store.id })
  }
  const limits = limitsFor(subscription)
  const bannerAllowed =
    limits.flashSales && subscription.status !== 'PAST_DUE'

  const bannersResult = await listStoreBannersAction()
  const banners = Array.isArray(bannersResult) ? bannersResult : []
  const loadError = 'error' in bannersResult ? bannersResult.error : null

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-4">
      <div>
        <p className="text-sm font-medium text-[var(--text-muted)]">Promosi toko</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">
          Banner Toko
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Satu slide banner marketing yang tampil di bawah header tokomu.
          Paketmu saat ini: <strong>{TIER_LABELS[subscription.tier]}</strong> —{' '}
          banner {bannerAllowed ? 'aktif' : 'hanya untuk Silver/Gold'}.
        </p>
      </div>

      {!bannerAllowed ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Banner marketing hanya tersedia untuk paket Silver dan Gold. Toko
          Free menampilkan slide iklan platform di storefront. Upgrade
          paketmu di{' '}
          <Link href="/dashboard/subscription" className="font-semibold underline">
            halaman Langganan
          </Link>{' '}
          untuk memakai fitur ini.
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      <BannerForm disabled={!bannerAllowed} />

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
        <h2 className="text-base font-bold text-[var(--text)]">Daftar banner</h2>
        {banners.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-soft)] px-4 py-5 text-sm text-[var(--text-muted)]">
            Belum ada banner. Buat yang pertama di atas.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {banners.map((banner) => (
              <div
                key={banner.id}
                className="overflow-hidden rounded-[28px] border border-[var(--line)] bg-white"
              >
                {banner.image_url ? (
                  <img
                    src={banner.image_url}
                    alt={banner.title}
                    className="h-32 w-full object-cover"
                  />
                ) : null}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-bold text-[var(--text)]">
                        {banner.title}
                      </p>
                      {banner.link_url ? (
                        <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                          → {banner.link_url}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
                        banner.is_active
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-gray-100 text-gray-600'
                      }`}
                    >
                      {banner.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <div className="mt-4">
                    <BannerActions bannerId={banner.id} isActive={banner.is_active} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
