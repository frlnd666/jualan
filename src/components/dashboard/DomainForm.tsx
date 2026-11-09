// Form tambah domain custom (Fase 5) — Client Component, owner-only.
// Tier gate tampil di halaman (bukan di sini): non-Gold tidak bisa
// menambah domain, tombol simpan tetap memanggil server action yang
// menegakkan batas yang sama di server.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addDomainAction } from '@/lib/actions/domains'

const inputClassName =
  'w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]'

export default function DomainForm({ disabled }: { disabled: boolean }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    setSaving(true)
    try {
      const result = await addDomainAction(new FormData(e.currentTarget))
      if (result.error) {
        setErrorMessage(result.error)
        return
      }
      setSuccessMessage(result.success ?? 'Domain ditambahkan.')
      e.currentTarget.reset()
      router.refresh()
    } catch {
      // P1-05: action melempar — tombol tidak boleh nyangkut "Menyimpan...".
      setErrorMessage('Gagal menambah domain. Periksa koneksi lalu coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6"
    >
      <h2 className="text-base font-bold text-[var(--text)]">Tambah domain sendiri</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Domain yang kamu beli di registrar (mis. tokoku.com). Tulis tanpa
        awalan www. dan tanpa https://.
      </p>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[var(--text)]">Domain</span>
          <input
            name="domain"
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="tokoku.com"
            disabled={disabled || saving}
            className={inputClassName}
          />
        </label>

        {errorMessage ? (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessage}
          </p>
        ) : null}
        {successMessage ? (
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {successMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={disabled || saving}
          className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Menyimpan…' : 'Tambah domain'}
        </button>
      </div>
    </form>
  )
}
