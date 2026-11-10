// Halaman admin (Fase 1, Bab 6): antrean verifikasi pembayaran
// langganan manual. Hanya role admin (public.is_admin()) yang bisa
// membuka halaman ini; penjual biasa diarahkan kembali.
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { resolvePaymentProofUrls } from '@/lib/payment-proof'
import { TIER_LABELS } from '@/lib/subscriptions'
import {
  RunTransitionsButton,
  VerifyPaymentButtons,
} from '@/components/dashboard/SubscriptionActions'
import {
  paginate,
  paymentStatusLabel,
  paymentStatusPillClass,
} from '@/lib/admin-ui'
import AdminPagination from '@/components/admin/AdminPagination'

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

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: rawPage } = await searchParams
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

  // Redesign 2026-11-10: antrean menunggu selalu tampil penuh
  // (biasanya sedikit dan butuh aksi), riwayat yang sudah diproses
  // dipaginasi server-side — sebelumnya satu query limit 50 dibagi dua
  // di client, riwayat lama hilang dari jangkauan.
  const { data: pendingData } = await supabase
    .from('subscription_payments')
    .select('id, store_id, tier, amount, method, proof_url, status, created_at')
    .eq('status', 'PENDING_VERIFICATION')
    .order('created_at', { ascending: false })
    .limit(100)
  const pending = (pendingData ?? []) as PaymentRow[]
  // Audit 2026-11-10: total antrean asli — daftar dibatasi 100, tapi
  // admin harus TAHU bila sebenarnya ada lebih (sebelumnya terpotong
  // diam-diam dan judul menampilkan angka yang terpotong).
  const { count: pendingTotal } = await supabase
    .from('subscription_payments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'PENDING_VERIFICATION')

  const { count: processedTotal } = await supabase
    .from('subscription_payments')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'PENDING_VERIFICATION')
  const pageInfo = paginate(processedTotal ?? 0, rawPage)
  const { data: processedData } = await supabase
    .from('subscription_payments')
    .select('id, store_id, tier, amount, method, proof_url, status, created_at')
    .neq('status', 'PENDING_VERIFICATION')
    .order('created_at', { ascending: false })
    .range(pageInfo.from, pageInfo.to)
  const processed = (processedData ?? []) as PaymentRow[]

  const payments = [...pending, ...processed]
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

  // Performa 2026-11-10: signed URL dibuat SATU batch untuk semua
  // pembayaran yang tampil (sebelumnya loop serial per pembayaran).
  const signedByStoredUrl = await resolvePaymentProofUrls(
    payments.map((p) => p.proof_url)
  )
  const proofUrls = new Map<string, string | null>()
  for (const p of payments) {
    proofUrls.set(
      p.id,
      p.proof_url ? (signedByStoredUrl.get(p.proof_url) ?? null) : null
    )
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
          Transisi langganan (cron harian)
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          Cron berjalan otomatis tiap hari 07:00 WIB: trial yang habis turun
          ke Free, periode berbayar yang habis masuk masa tenggang 7 hari,
          tenggang yang habis turun ke Free, dan pengingat H-3/H-1 ke pemilik
          toko. Tombol ini menjalankan logika yang sama secara manual —
          aman diulang (transisi idempotent, pengingat tidak dikirim dua
          kali di hari yang sama).
        </p>
        <div className="mt-4">
          <RunTransitionsButton />
        </div>
      </section>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
        <h2 className="text-base font-bold text-[var(--text)]">
          Menunggu verifikasi ({pendingTotal ?? pending.length})
          {(pendingTotal ?? 0) > pending.length
            ? ` — menampilkan ${pending.length} terbaru`
            : ''}
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
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--text)]">
                      {storeNames.get(p.store_id) ?? p.store_id}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${paymentStatusPillClass(p.status)}`}
                      >
                        {paymentStatusLabel(p.status)}
                      </span>
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
                  ) : p.proof_url ? (
                    // P2-19: bukti ada tapi signed URL gagal dibuat —
                    // jangan tulis "Tanpa bukti" yang menyesatkan.
                    <span className="shrink-0 text-xs font-medium text-amber-700">
                      Bukti tidak bisa dimuat
                    </span>
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
          Sudah diproses ({processedTotal ?? 0})
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
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${paymentStatusPillClass(p.status)}`}
                >
                  {paymentStatusLabel(p.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <AdminPagination
          basePath="/dashboard/admin/subscriptions"
          page={pageInfo.page}
          pageCount={pageInfo.pageCount}
          total={pageInfo.total}
          unitLabel="pembayaran"
        />
      </section>
    </div>
  )
}
