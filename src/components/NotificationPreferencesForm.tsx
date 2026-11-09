// Form pengaturan notifikasi (dipakai halaman pembeli /akun/notifikasi
// dan seller /dashboard/notifications — komponen yang sama).
'use client'

import { useState, useTransition } from 'react'
import { saveNotificationPreferencesAction } from '@/lib/actions/notification-preferences'
import type { NotificationPreferences } from '@/lib/notify'

export default function NotificationPreferencesForm({
  initial,
  migrationMissing,
}: {
  initial: NotificationPreferences
  migrationMissing: boolean
}) {
  const [emailEnabled, setEmailEnabled] = useState(initial.emailEnabled)
  const [whatsappEnabled, setWhatsappEnabled] = useState(initial.whatsappEnabled)
  const [whatsappNumber, setWhatsappNumber] = useState(initial.whatsappNumber ?? '')
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  function save() {
    setMessage('')
    const formData = new FormData()
    if (emailEnabled) formData.set('emailEnabled', 'on')
    if (whatsappEnabled) formData.set('whatsappEnabled', 'on')
    formData.set('whatsappNumber', whatsappNumber)
    startTransition(async () => {
      const result = await saveNotificationPreferencesAction(formData)
      setMessage(result.error ?? 'Pengaturan tersimpan.')
    })
  }

  if (migrationMissing) {
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
        Pengaturan email &amp; WhatsApp belum aktif — tabel preferensi belum ada.
        Jalankan migrasi 20261109_notification_prefs.sql di Supabase dulu.
        Notifikasi in-app tetap jalan.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={emailEnabled}
          onChange={(e) => setEmailEnabled(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[#0b6b4a]"
        />
        <span>
          <span className="block text-sm font-semibold text-[var(--text)]">
            Notifikasi email
          </span>
          <span className="block text-sm text-[var(--text-muted)]">
            Pesanan, pembayaran, dan langganan dikirim juga ke email akunmu
            (gratis, via Resend).
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={whatsappEnabled}
          onChange={(e) => setWhatsappEnabled(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[#0b6b4a]"
        />
        <span>
          <span className="block text-sm font-semibold text-[var(--text)]">
            Notifikasi WhatsApp
          </span>
          <span className="block text-sm text-[var(--text-muted)]">
            Pesan template WhatsApp ke nomormu. Tanpa nomor di bawah, dipakai
            nomor HP dari alamat/order terakhir (pembeli) atau nomor WhatsApp
            toko (penjual).
          </span>
        </span>
      </label>

      <div>
        <label
          htmlFor="whatsappNumber"
          className="block text-sm font-semibold text-[var(--text)]"
        >
          Nomor WhatsApp khusus notifikasi (opsional)
        </label>
        <input
          id="whatsappNumber"
          type="tel"
          value={whatsappNumber}
          onChange={(e) => setWhatsappNumber(e.target.value)}
          placeholder="08xxxxxxxxxx"
          className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-[var(--text)]"
        />
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Kosongkan untuk memakai nomor HP dari pesanan/alamatmu.
        </p>
      </div>

      <div>
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-xl bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Menyimpan…' : 'Simpan pengaturan'}
        </button>
        {message ? (
          <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{message}</p>
        ) : null}
      </div>
    </div>
  )
}
