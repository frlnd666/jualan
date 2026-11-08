// Halaman Langganan (Fase 1, Bab 3–6): paket aktif + status + sisa masa,
// form upgrade/perpanjang manual, riwayat pembayaran langganan.
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import StaffDeniedCard from '@/components/dashboard/StaffDeniedCard'
import { redirect } from 'next/navigation'
import {
  FREE_SUBSCRIPTION,
  STATUS_LABELS,
  TIER_LABELS,
  type SubscriptionRow,
} from '@/lib/subscriptions'
import { effectiveTier, limitsFor } from '@/lib/subscription-tiers'
import SubscriptionPaymentForm from '@/components/dashboard/SubscriptionPaymentForm'
import {
  ActivateFreeButton,
  CancelSubscriptionButton,
} from '@/components/dashboard/SubscriptionActions'

function daysLeft(iso: string | null): number | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)))
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

type PaymentRow = {
  id: string
  tier: string
  amount: number | string
  method: string
  status: string
  created_at: string
}

export default async function SubscriptionPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fase 2: langganan hanya untuk pemilik toko — staff tidak boleh masuk.
  const { data: subProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if ((subProfile as { role?: string } | null)?.role === 'staff') {
    return <StaffDeniedCard title="Langganan" />
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id, name, slug')
    .eq('owner_id', user.id)
    .single()
  if (!store) redirect('/dashboard/settings')

  const { data: subscriptionRow } = await supabase
    .from('subscriptions')
    .select('tier, status, current_period_end, trial_ends_at, grace_ends_at')
    .eq('store_id', store.id)
    .maybeSingle()

  const hasRow = Boolean(subscriptionRow)
  const subscription: SubscriptionRow =
    (subscriptionRow as SubscriptionRow | null) ?? FREE_SUBSCRIPTION
  const { tier, premiumLocked } = effectiveTier(subscription)
  const limits = limitsFor(subscription)

  const { count: productCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', store.id)

  const { data: paymentsData } = await supabase
    .from('subscription_payments')
    .select('id, tier, amount, method, status, created_at')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .limit(20)
  const payments = (paymentsData ?? []) as PaymentRow[]
  const hasPending = payments.some((p) => p.status === 'PENDING_VERIFICATION')

  const { data: isAdmin } = await supabase.rpc('is_admin')

  const trialDays =
    subscription.status === 'TRIALING'
      ? daysLeft(
          (subscriptionRow as { trial_ends_at?: string | null } | null)
            ?.trial_ends_at ?? null
        )
      : null
  const graceDays =
    subscription.status === 'PAST_DUE'
      ? daysLeft(
          (subscriptionRow as { grace_ends_at?: string | null } | null)
            ?.grace_ends_at ?? null
        )
      : null

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <p className="text-sm font-medium text-[var(--text-muted)]">Langganan</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">
          Paket &amp; Langganan
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          {store.name} • Paket menentukan batas produk, foto, dan fitur yang
          bisa kamu pakai.
        </p>
      </div>

      {!hasRow ? (
        <section className="rounded-[32px] border border-amber-200 bg-amber-50 p-5 shadow-[var(--shadow-sm)]">
          <h2 className="text-base font-bold text-amber-900">
            Langganan belum diaktifkan
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            Tokomu belum punya baris langganan (dibuat sebelum Fase 1).
            Aktifkan paket Free dulu — gratis, tanpa mengubah apa pun.
          </p>
          <div className="mt-4">
            <ActivateFreeButton storeId={store.id} />
          </div>
        </section>
      ) : null}

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--text-muted)]">
              Paket aktif
            </p>
            <h2 className="mt-1 text-xl font-bold text-[var(--text)]">
              {TIER_LABELS[tier]}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Status: {STATUS_LABELS[subscription.status]}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--surface-soft)] px-3 py-2 text-[11px] font-semibold text-[var(--text)]">
            {subscription.status === 'TRIALING' && trialDays !== null
              ? `Trial tersisa ${trialDays} hari`
              : subscription.status === 'PAST_DUE' && graceDays !== null
                ? `Tenggang tersisa ${graceDays} hari`
                : subscription.status === 'ACTIVE' && subscription.current_period_end
                  ? `Berakhir ${formatDate(subscription.current_period_end)}`
                  : tier === 'free'
                    ? 'Gratis selamanya'
                    : ''}
          </span>
        </div>

        {premiumLocked && subscription.status === 'PAST_DUE' ? (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Pembayaranmu telat — toko tetap jualan, tapi tambah produk baru
            dan fitur premium dikunci sampai kamu memperpanjang di bawah.
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Produk
            </p>
            <p className="mt-1 text-sm font-bold text-[var(--text)]">
              {productCount ?? 0} / {limits.maxProducts}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Foto per produk
            </p>
            <p className="mt-1 text-sm font-bold text-[var(--text)]">
              maks {limits.maxPhotosPerProduct}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Staff
            </p>
            <p className="mt-1 text-sm font-bold text-[var(--text)]">
              maks {limits.maxStaff}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Voucher / Flash sale
            </p>
            <p className="mt-1 text-sm font-bold text-[var(--text)]">
              {limits.vouchers ? 'Ya' : 'Tidak (upgrade)'}
            </p>
          </div>
        </div>

        {subscription.tier !== 'free' ? (
          <div className="mt-5 border-t border-[var(--line)] pt-4">
            <CancelSubscriptionButton />
          </div>
        ) : null}
      </section>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
        <h2 className="text-base font-bold text-[var(--text)]">
          Upgrade / Perpanjang
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Bayar manual lewat QRIS atau transfer, lalu upload bukti. Admin
          memverifikasi, dan paketmu aktif. Tidak ada auto-debit.
        </p>
        <div className="mt-5">
          <SubscriptionPaymentForm
            currentTier={tier}
            hasPending={hasPending}
          />
        </div>
      </section>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
        <h2 className="text-base font-bold text-[var(--text)]">
          Riwayat pembayaran langganan
        </h2>
        {payments.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Belum ada pembayaran langganan.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-[var(--text)]">
                    {TIER_LABELS[p.tier as 'silver' | 'gold']} •{' '}
                    {p.method === 'QRIS' ? 'QRIS' : 'Transfer'}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {new Date(p.created_at).toLocaleDateString('id-ID')} • Rp
                    {Number(p.amount).toLocaleString('id-ID')}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                    p.status === 'VERIFIED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : p.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {p.status === 'VERIFIED'
                    ? 'Terverifikasi'
                    : p.status === 'REJECTED'
                      ? 'Ditolak'
                      : 'Menunggu verifikasi'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin === true ? (
        <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
          <h2 className="text-base font-bold text-[var(--text)]">Admin</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Kamu login sebagai admin platform.
          </p>
          <Link
            href="/dashboard/admin/subscriptions"
            className="mt-3 inline-flex rounded-2xl bg-[var(--text)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Antrean verifikasi pembayaran langganan
          </Link>
        </section>
      ) : null}
    </div>
  )
}
