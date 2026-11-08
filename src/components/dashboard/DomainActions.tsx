// Aksi per domain: cek verifikasi + hapus (Fase 5) — Client Component.
// Memanggil server action lalu refresh halaman supaya status terbaru tampil.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  removeDomainAction,
  verifyDomainAction,
} from '@/lib/actions/domains'

export default function DomainActions({ domain }: { domain: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  async function run(
    action: (d: string) => Promise<{ success?: string; error?: string }>
  ) {
    setBusy(true)
    setMessage('')
    const result = await action(domain)
    setBusy(false)
    if (result.error) {
      setIsError(true)
      setMessage(result.error)
      return
    }
    setIsError(false)
    setMessage(result.success ?? 'Berhasil.')
    router.refresh()
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => run(verifyDomainAction)}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Memeriksa…' : 'Cek verifikasi'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Hapus domain ${domain} dari toko ini?`)) {
              run(removeDomainAction)
            }
          }}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-600 transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          Hapus
        </button>
      </div>
      {message ? (
        <p
          className={`mt-3 rounded-2xl px-4 py-3 text-sm font-medium ${
            isError ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}
