// Aksi per voucher di daftar (Fase 3) — Client Component.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  deleteVoucherAction,
  toggleVoucherAction,
} from '@/lib/actions/vouchers'

export default function VoucherActions({
  voucherId,
  isActive,
}: {
  voucherId: string
  isActive: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function toggle() {
    setBusy(true)
    setErrorMessage('')
    const result = await toggleVoucherAction(voucherId, !isActive)
    setBusy(false)
    if (result.error) setErrorMessage(result.error)
    else router.refresh()
  }

  async function remove() {
    if (!window.confirm('Hapus voucher ini? Voucher yang sudah dipakai tetap tercatat di order lama.')) {
      return
    }
    setBusy(true)
    setErrorMessage('')
    const result = await deleteVoucherAction(voucherId)
    setBusy(false)
    if (result.error) setErrorMessage(result.error)
    else router.refresh()
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="rounded-2xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--text)] disabled:opacity-50"
        >
          {isActive ? 'Nonaktifkan' : 'Aktifkan'}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Hapus
        </button>
      </div>
      {errorMessage ? (
        <p className="mt-2 text-xs font-medium text-red-600">{errorMessage}</p>
      ) : null}
    </div>
  )
}
