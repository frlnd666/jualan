// Tombol bekukan / buka bekukan toko (client, admin-only).
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { suspendStoreAction, unsuspendStoreAction } from '@/lib/actions/admin'

export default function AdminStoreActions({
  storeId,
  storeName,
  isSuspended,
}: {
  storeId: string
  storeName: string
  isSuspended: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isPending, startTransition] = useTransition()

  function suspend() {
    if (
      !window.confirm(
        `Bekukan toko "${storeName}"? Storefront jadi 404 dan checkout mati sampai dibuka lagi.`
      )
    )
      return
    setError('')
    setNotice('')
    startTransition(async () => {
      const result = await suspendStoreAction(storeId)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setNotice('Toko dibekukan.')
      router.refresh()
    })
  }

  function unsuspend() {
    setError('')
    setNotice('')
    startTransition(async () => {
      const result = await unsuspendStoreAction(storeId)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setNotice('Pembekuan dibuka — toko aktif lagi.')
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {isSuspended ? (
        <button
          type="button"
          onClick={unsuspend}
          disabled={isPending}
          className="rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isPending ? 'Memproses...' : 'Buka pembekuan'}
        </button>
      ) : (
        <button
          type="button"
          onClick={suspend}
          disabled={isPending}
          className="rounded-2xl bg-red-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isPending ? 'Memproses...' : 'Bekukan toko'}
        </button>
      )}
      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {notice}
        </p>
      ) : null}
    </div>
  )
}
