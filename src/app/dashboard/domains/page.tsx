// Halaman kelola domain (Fase 5) — owner-only, Gold saja.
// Staff ditolak (domain = keputusan pemilik) lewat StaffDeniedCard,
// sama seperti Voucher/Pengaturan. Subdomain platform {slug}.domain
// hanya aktif bila env NEXT_PUBLIC_PLATFORM_DOMAIN sudah diset Ferlan;
// bila belum, halaman menjelaskan apa yang dibutuhkan.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOwnerStore } from '@/lib/dashboard-access'
import { getDomainsPageDataAction } from '@/lib/actions/domains'
import StaffDeniedCard from '@/components/dashboard/StaffDeniedCard'
import DomainForm from '@/components/dashboard/DomainForm'
import DomainActions from '@/components/dashboard/DomainActions'
import type { DomainStatus } from '@/lib/actions/domains'

const STATUS_LABEL: Record<DomainStatus, string> = {
  pending: 'Menunggu DNS',
  verified: 'Terverifikasi',
  failed: 'Gagal diverifikasi',
}

const STATUS_STYLE: Record<DomainStatus, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  verified: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  failed: 'border-red-200 bg-red-50 text-red-700',
}

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

export default async function DomainsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const store = await getOwnerStore(supabase, user.id)
  if (!store) {
    // Staff / tanpa toko: domain hanya untuk pemilik toko.
    return <StaffDeniedCard title="Domain" />
  }

  const data = await getDomainsPageDataAction()

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-4">
      <div>
        <p className="text-sm font-medium text-[var(--text-muted)]">Toko · Gold</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">Domain</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Buka tokomu lewat alamat sendiri. Paketmu saat ini:{' '}
          <strong>{data.tierLabel}</strong> — domain sendiri{' '}
          {data.customDomainAllowed ? 'aktif' : 'hanya untuk paket Gold'}.
        </p>
      </div>

      {data.loadError ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          {data.loadError}
        </p>
      ) : null}

      {!data.customDomainAllowed ? (
        <div className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
          <p className="text-sm font-semibold text-[var(--text)]">
            Domain sendiri adalah fitur Gold.
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Upgrade ke Gold (Rp50.000/3 bulan) untuk memakai domain sendiri dan
            subdomain toko. Sementara itu tokomu tetap bisa dibuka lewat{' '}
            <code className="rounded bg-[var(--surface-soft)] px-1.5 py-0.5 text-xs">
              cuan.is-a.web.id/{data.storeSlug}
            </code>
            .
          </p>
          <Link
            href="/dashboard/subscription"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white"
          >
            Lihat paket Gold
          </Link>
        </div>
      ) : null}

      {/* Subdomain platform {slug}.domain */}
      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
        <h2 className="text-base font-bold text-[var(--text)]">Subdomain toko</h2>
        {data.platformDomain ? (
          <>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Alamat pendek tokomu di domain platform:
            </p>
            <p className="mt-3">
              <a
                href={data.subdomainUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm font-bold text-[var(--primary)] underline decoration-[var(--primary)]/30 underline-offset-2"
              >
                {data.subdomainUrl}
              </a>
            </p>
            {data.wildcardAdded === false ? (
              <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
                Subdomain belum aktif: wildcard <code>*.{data.platformDomain}</code>{' '}
                belum ditambahkan ke project Vercel. Tambahkan di Vercel Dashboard
                → Settings → Domains, lalu pasang DNS wildcard{' '}
                <code>* CNAME cname.vercel-dns.com</code> di registrar.
              </p>
            ) : data.wildcardAdded === true ? (
              <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                Wildcard sudah terdaftar di Vercel — subdomain di atas aktif.
              </p>
            ) : (
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                Status wildcard tidak bisa dicek otomatis (token Vercel belum
                dipasang). Bila subdomain belum bisa dibuka, pastikan{' '}
                <code>*.{data.platformDomain}</code> sudah ditambahkan di Vercel
                Dashboard → Settings → Domains.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Domain platform belum dipasang — subdomain toko belum bisa dipakai.
            </p>
            <div className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
              <p className="font-semibold text-[var(--text)]">
                Yang dibutuhkan supaya subdomain aktif:
              </p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Beli domain untuk platform (mis. cuan.id) di registrar.</li>
                <li>
                  Isi env <code>NEXT_PUBLIC_PLATFORM_DOMAIN</code> dengan domain
                  itu di Vercel, lalu redeploy.
                </li>
                <li>
                  Tambahkan <code>*.domain</code> di Vercel Dashboard → Settings
                  → Domains.
                </li>
                <li>
                  Pasang DNS wildcard di registrar:{' '}
                  <code>* CNAME cname.vercel-dns.com</code>.
                </li>
              </ol>
              <p>
                Setelah itu tokomu otomatis bisa dibuka di{' '}
                <code className="rounded bg-[var(--surface-soft)] px-1.5 py-0.5 text-xs">
                  {data.storeSlug}.domain-platform
                </code>{' '}
                tanpa pengaturan tambahan.
              </p>
            </div>
          </>
        )}
      </section>

      {/* Domain custom */}
      {data.customDomainAllowed ? (
        <DomainForm disabled={false} />
      ) : (
        <DomainForm disabled />
      )}

      <section className="space-y-3">
        <h2 className="text-base font-bold text-[var(--text)]">Domain terdaftar</h2>
        {data.domains.length === 0 ? (
          <p className="rounded-[32px] border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--text-muted)]">
            Belum ada domain. Tambahkan domainmu di atas — setelah DNS benar,
            tokomu bisa dibuka lewat domain itu.
          </p>
        ) : (
          data.domains.map((domain) => (
            <article
              key={domain.id}
              className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <a
                    href={`https://${domain.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-base font-bold text-[var(--text)] underline decoration-[var(--line)] underline-offset-2"
                  >
                    {domain.domain}
                  </a>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Ditambahkan {formatDate(domain.created_at)}
                    {domain.verified_at
                      ? ` · terverifikasi ${formatDate(domain.verified_at)}`
                      : ''}
                    {domain.vercel_added ? ' · terdaftar di Vercel' : ' · belum di Vercel'}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[domain.status]}`}
                >
                  {STATUS_LABEL[domain.status]}
                </span>
              </div>

              <div className="mt-4 rounded-2xl bg-[var(--surface-soft)] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  DNS yang harus dipasang di registrar
                </p>
                <ul className="mt-2 space-y-1.5">
                  {domain.dns.map((record) => (
                    <li key={`${record.type}-${record.name}`} className="text-sm">
                      <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
                        {record.type} {record.name}
                      </code>{' '}
                      <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
                        {record.value}
                      </code>{' '}
                      <span className="text-[var(--text-muted)]">— {record.note}</span>
                    </li>
                  ))}
                </ul>
                {!data.vercelTokenConfigured ? (
                  <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
                    Token Vercel belum dipasang di env, jadi domain ini belum
                    otomatis terdaftar di Vercel. Tambahkan manual di Vercel
                    Dashboard → Settings → Domains, lalu tekan &ldquo;Cek
                    verifikasi&rdquo; setelah DNS benar.
                  </p>
                ) : null}
              </div>

              <div className="mt-4">
                <DomainActions domain={domain.domain} />
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  )
}
