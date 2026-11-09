// Form tes notifikasi admin (client) — dipakai /dashboard/admin/notifications.
'use client'

import { useState, useTransition } from 'react'
import {
  sendNotificationTestAction,
  type NotificationTestChannelResult,
} from '@/lib/actions/notifications'

function channelLabel(status: NotificationTestChannelResult['status']): string {
  return status === 'sent' ? 'Terkirim' : status === 'skipped' ? 'Dilewati' : 'Gagal'
}

export default function NotificationTestForm() {
  const [phone, setPhone] = useState('')
  const [result, setResult] = useState<{
    email: NotificationTestChannelResult
    whatsapp: NotificationTestChannelResult
  } | null>(null)
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  function run() {
    setMessage('')
    setResult(null)
    const formData = new FormData()
    formData.set('phone', phone)
    startTransition(async () => {
      const res = await sendNotificationTestAction(formData)
      if ('error' in res) {
        setMessage(res.error)
        return
      }
      setResult({ email: res.email, whatsapp: res.whatsapp })
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="testPhone"
          className="block text-sm font-semibold text-[var(--text)]"
        >
          Nomor WhatsApp untuk tes (opsional)
        </label>
        <input
          id="testPhone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="08xxxxxxxxxx"
          className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-[var(--text)]"
        />
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Email tes selalu dikirim ke email akun admin ini. WA tes memakai
          template <code>cuan_test</code> (1 parameter) — buat dulu di Meta
          bila belum ada, atau set WHATSAPP_TEMPLATE_TEST.
        </p>
      </div>

      <button
        type="button"
        onClick={run}
        disabled={isPending}
        className="rounded-xl bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? 'Mengirim…' : 'Kirim tes'}
      </button>

      {message ? <p className="text-sm font-medium text-rose-700">{message}</p> : null}

      {result ? (
        <ul className="space-y-2">
          {(
            [
              ['Email', result.email],
              ['WhatsApp', result.whatsapp],
            ] as Array<[string, NotificationTestChannelResult]>
          ).map(([label, r]) => (
            <li
              key={label}
              className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3"
            >
              <p className="text-sm font-bold text-[var(--text)]">
                {label}: {channelLabel(r.status)}
              </p>
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">{r.detail}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
