// Halaman test notifikasi admin — kirim email tes ke email admin sendiri
// + WA tes ke nomor yang diisi, hasil tampil per channel. Admin-only.
// Diputuskan sebagai halaman sendiri di /dashboard/admin (bukan seksi di
// halaman subscriptions) supaya tidak mencampur antrean verifikasi
// langganan dengan alat tes; tautan ada di /dashboard/admin.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/admin-access'
import { isEmailConfigured } from '@/lib/email-resend'
import { isWhatsAppConfigured } from '@/lib/whatsapp'
import NotificationTestForm from '@/components/dashboard/NotificationTestForm'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

export default async function AdminNotificationsTestPage() {
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
          Tes notifikasi
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

  const emailReady = isEmailConfigured()
  const whatsappReady = isWhatsAppConfigured()

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <p className="text-sm font-medium text-[var(--text-muted)]">Admin</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">
          Tes notifikasi email &amp; WhatsApp
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          Email tes dikirim ke email akun admin ini (
          {user.email ?? 'tidak ada email'}). WhatsApp tes dikirim ke nomor
          yang kamu isi. Hasil tampil per channel — channel yang belum
          dikonfigurasi akan tertulis &ldquo;Dilewati&rdquo;, bukan gagal.
        </p>
      </div>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
        <h2 className="text-base font-bold text-[var(--text)]">
          Status konfigurasi
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-start gap-2">
            {emailReady ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                aria-hidden
              />
            ) : (
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                aria-hidden
              />
            )}
            <span>
              <b>Email (Resend):</b>{' '}
              {emailReady
                ? 'RESEND_API_KEY terisi.'
                : 'RESEND_API_KEY belum diisi — email akan dilewati.'}
            </span>
          </li>
          <li className="flex items-start gap-2">
            {whatsappReady ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                aria-hidden
              />
            ) : (
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                aria-hidden
              />
            )}
            <span>
              <b>WhatsApp (Meta Cloud API):</b>{' '}
              {whatsappReady
                ? 'Token + Phone Number ID terisi.'
                : 'WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID belum diisi — WA akan dilewati.'}
            </span>
          </li>
        </ul>
        <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
          Tanpa domain terverifikasi di Resend, email hanya bisa diterima
          email pemilik akun Resend. Tanpa template{' '}
          <code>cuan_test</code> yang disetujui di Meta, tes WA akan gagal —
          lihat supabase/README.md bagian &ldquo;Notifikasi email +
          WhatsApp&rdquo;.
        </p>
      </section>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
        <h2 className="text-base font-bold text-[var(--text)]">Kirim tes</h2>
        <div className="mt-4">
          <NotificationTestForm />
        </div>
      </section>

      <p className="text-sm">
        <Link
          href="/dashboard/admin"
          className="font-semibold text-[var(--text)] underline"
        >
          ← Kembali ke Admin Platform
        </Link>
      </p>
    </div>
  )
}
