// Form buat voucher (Fase 3) — Client Component, owner-only.
// Tier gate tampil di halaman (bukan di sini): Free tidak bisa membuat
// voucher, tombol simpan tetap memanggil server action yang menegakkan
// batas yang sama di server.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createVoucherAction } from '@/lib/actions/vouchers'

const inputClassName =
  'w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]'

export default function VoucherForm({ disabled }: { disabled: boolean }) {
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
      const result = await createVoucherAction(new FormData(e.currentTarget))
      if (result.error) {
        setErrorMessage(result.error)
        return
      }
      setSuccessMessage(result.success ?? 'Voucher dibuat.')
      e.currentTarget.reset()
      router.refresh()
    } catch {
      // P1-05: action melempar — tombol tidak boleh nyangkut "Menyimpan...".
      setErrorMessage('Gagal membuat voucher. Periksa koneksi lalu coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6"
    >
      <h2 className="text-base font-bold text-[var(--text)]">Buat voucher baru</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Kode dibagikan ke customer dan dipakai saat checkout. Diskon dihitung
        dari subtotal (sebelum ongkir).
      </p>

      <div className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--text)]">Kode voucher</span>
            <input
              name="code"
              required
              disabled={disabled || saving}
              className={inputClassName}
              placeholder="HEMAT10"
              style={{ textTransform: 'uppercase' }}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--text)]">Tipe diskon</span>
            <select name="discountType" disabled={disabled || saving} className={inputClassName} defaultValue="percent">
              <option value="percent">Persen (%)</option>
              <option value="fixed">Nominal (Rp)</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--text)]">Nilai diskon</span>
            <input
              name="discountValue"
              required
              disabled={disabled || saving}
              className={inputClassName}
              placeholder="10"
              inputMode="numeric"
            />
            <span className="mt-2 block text-xs text-[var(--text-muted)]">
              Persen 1–100, atau nominal rupiah.
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--text)]">Minimum belanja (Rp)</span>
            <input
              name="minOrder"
              disabled={disabled || saving}
              className={inputClassName}
              placeholder="0"
              inputMode="numeric"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--text)]">Maks. pemakaian</span>
            <input
              name="maxUses"
              disabled={disabled || saving}
              className={inputClassName}
              placeholder="Kosong = tanpa batas"
              inputMode="numeric"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--text)]">Berlaku dari</span>
            <input
              name="startsAt"
              type="datetime-local"
              disabled={disabled || saving}
              className={inputClassName}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--text)]">Berlaku sampai</span>
            <input
              name="endsAt"
              type="datetime-local"
              disabled={disabled || saving}
              className={inputClassName}
            />
          </label>
        </div>
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {successMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={disabled || saving}
        className="mt-5 w-full rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {saving ? 'Menyimpan...' : 'Buat voucher'}
      </button>
    </form>
  )
}
