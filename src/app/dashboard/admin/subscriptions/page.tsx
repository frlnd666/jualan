// Halaman admin (Fase 1, Bab 6): antrean verifikasi pembayaran
// langganan manual. Hanya role admin (public.is_admin()) yang bisa
// membuka halaman ini; penjual biasa diarahkan kembali.
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { resolvePaymentProofUrl } from '@/lib/payment-proof'
import { TIER_LABELS } from '@/lib/subscriptions'
import { VerifyPaymentButtons } from '@/components/dashboard/SubscriptionActions'

type PaymentRow = {
  id: string
  store_id: string
  tier: string
  amount: number | string
  method: string
  proof_url: string | null
  status: string
  created_at: string
}

export default async function AdminSubscriptionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-[32px] border border-rose-200 bg-rose-50 p-6">
          <h1 className="text-xl font-bold text-rose-900">
            Hanya untuk admin platform
          </h1>
          <p className="mt-2 text-sm text-rose-800">
            Halaman ini hanya bisa dibuka akun dengan peran admin.
          </p>
          <Link
            href="/dashboard/subscription"
            className="mt-4 inline-flex rounded-2xl bg-[var(--text)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Kembali ke Langganan
          </Link>
        </div>
      </div>
    )
  }

  const { data: paymentsData } = await supabase
    .from('subscription_payments')
    .select('id, store_id, tier, amount, method, proof_url, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  const payments = (paymentsData ?? []) as PaymentRow[]

  const storeIds = Array.from(new Set(payments.map((p) => p.store_id)))
  const storeNames = new Map<string, string>()
  if (storeIds.length > 0) {
    const { data: stores } = await supabase
      .from('stores')
      .select('id, name, slug')
      .in('id', storeIds)
    for (const s of (stores ?? []) as Array<{ id: string; name: string; slug: string }>) {
      storeNames.set(s.id, `${s.name} (/${s.slug})`)
    }
  }

  const pending = payments.filter((p) => p.status === 'PENDING_VERIFICATION')
  const processed = payments.filter((p) => p.status !== 'PENDING_VERIFICATION')

  const proofUrls = new Map<string, string | null>()
  for (const p of payments) {
    proofUrls.set(p.id, await resolvePaymentProofUrl(p.proof_url))
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <p className="text-sm font-medium text-[var(--text-muted)]">Admin</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">
          Verifikasi pembayaran langganan
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          Verifikasi mengaktifkan paket yang dibeli (Silver 1 bulan / Gold 3
          bulan). Penolakan hanya mengubah status pembayaran — paket toko
          tidak berubah.
        </p>
      </div>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
        <h2 className="text-base font-bold text-[var(--text)]">
          Menunggu verifikasi ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Tidak ada pembayaran yang menunggu.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {pending.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-[var(--line)] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--text)]">
                      {storeNames.get(p.store_id) ?? p.store_id}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                      {TIER_LABELS[p.tier as 'silver' | 'gold']} •{' '}
                      {p.method === 'QRIS' ? 'QRIS' : 'Transfer'} • Rp
                      {Number(p.amount).toLocaleString('id-ID')}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      Diajukan{' '}
                      {new Date(p.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  {proofUrls.get(p.id) ? (
                    <a
                      href={proofUrls.get(p.id) ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--text)]"
                    >
                      Lihat bukti
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-[var(--text-muted)]">
                      Tanpa bukti
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <VerifyPaymentButtons paymentId={p.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
        <h2 className="text-base font-bold text-[var(--text)]">
          Sudah diproses ({processed.length})
        </h2>
        {processed.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Belum ada pembayaran yang diproses.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {processed.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-[var(--text)]">
                    {storeNames.get(p.store_id) ?? p.store_id} •{' '}
                    {TIER_LABELS[p.tier as 'silver' | 'gold']}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Rp{Number(p.amount).toLocaleString('id-ID')} •{' '}
                    {new Date(p.created_at).toLocaleDateString('id-ID')}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                    p.status === 'VERIFIED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {p.status === 'VERIFIED' ? 'Terverifikasi' : 'Ditolak'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
