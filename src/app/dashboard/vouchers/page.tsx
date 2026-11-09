// Halaman kelola voucher (Fase 3) — owner-only.
// Staff ditolak (voucher = keputusan harga pemilik) lewat StaffDeniedCard,
// sama seperti Pengaturan/Langganan. Free tidak bisa membuat voucher
// (tier-gated di server action + pemberitahuan di sini).
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
import { listVouchersAction } from '@/lib/actions/vouchers'
import StaffDeniedCard from '@/components/dashboard/StaffDeniedCard'
import VoucherForm from '@/components/dashboard/VoucherForm'
import VoucherActions from '@/components/dashboard/VoucherActions'

function formatDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(date)
}

export default async function VouchersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const store = await getOwnerStore(supabase, user.id)
  if (!store) {
    // Staff / tanpa toko: voucher hanya untuk pemilik toko.
    return <StaffDeniedCard title="Voucher" />
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
  const vouchersAllowed = limits.vouchers && subscription.status !== 'PAST_DUE'

  const result = await listVouchersAction()
  const vouchers = Array.isArray(result) ? result : []
  const loadError = 'error' in result ? result.error : null

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-4">
      <div>
        <p className="text-sm font-medium text-[var(--text-muted)]">Promosi toko</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">Voucher</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Buat kode diskon untuk customer. Paketmu saat ini:{' '}
          <strong>{TIER_LABELS[subscription.tier]}</strong> — voucher{' '}
          {vouchersAllowed ? 'aktif' : 'hanya untuk Silver/Gold'}.
        </p>
      </div>

      {!vouchersAllowed ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Voucher hanya tersedia untuk paket Silver dan Gold. Upgrade paketmu
          di{' '}
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

      <VoucherForm disabled={!vouchersAllowed} />

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
        <h2 className="text-base font-bold text-[var(--text)]">Daftar voucher</h2>
        {vouchers.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-soft)] px-4 py-5 text-sm text-[var(--text-muted)]">
            Belum ada voucher. Buat voucher pertama di atas.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {vouchers.map((v) => (
              <div
                key={v.id}
                className="rounded-[28px] border border-[var(--line)] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-[var(--text)]">{v.code}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                      {v.discount_type === 'percent'
                        ? `Diskon ${v.discount_value}%`
                        : `Diskon Rp ${Number(v.discount_value).toLocaleString('id-ID')}`}
                      {v.min_order > 0
                        ? ` • Min. belanja Rp ${Number(v.min_order).toLocaleString('id-ID')}`
                        : ''}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Dipakai {v.used_count}
                      {v.max_uses !== null ? ` / ${v.max_uses}` : ' kali'}
                      {v.max_uses_per_buyer !== null
                        ? ` • maks ${v.max_uses_per_buyer}× per pembeli`
                        : ''}
                      {v.starts_at || v.ends_at
                        ? ` • ${formatDate(v.starts_at)} – ${formatDate(v.ends_at)}`
                        : ''}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
                      v.is_active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-gray-100 text-gray-600'
                    }`}
                  >
                    {v.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <div className="mt-4">
                  <VoucherActions voucherId={v.id} isActive={v.is_active} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
