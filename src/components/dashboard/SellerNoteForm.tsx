// Catatan internal seller per order (Fase 3) — Client Component.
// Catatan ini HANYA tampil di dashboard (tidak dikirim ke customer).
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveSellerNoteAction } from '@/lib/actions/order-management'

export default function SellerNoteForm({
  orderId,
  initialNote,
}: {
  orderId: string
  initialNote: string | null
}) {
  const router = useRouter()
  const [note, setNote] = useState(initialNote ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function save() {
    setSaving(true)
    setMessage('')
    const formData = new FormData()
    formData.set('orderId', orderId)
    formData.set('note', note)
    const result = await saveSellerNoteAction(formData)
    setSaving(false)
    if (!result.success) {
      setMessage(result.error ?? 'Gagal menyimpan catatan.')
      return
    }
    setMessage('Catatan tersimpan ✓')
    router.refresh()
  }

  return (
    <div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="Catatan internal — mis. 'customer minta packing kayu', 'tunggu stok masuk Senin'."
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-400"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {note.length}/500 — hanya terlihat penjual & staff.
        </p>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-2xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Menyimpan...' : 'Simpan catatan'}
        </button>
      </div>
      {message ? (
        <p className="mt-2 text-xs font-medium text-gray-600">{message}</p>
      ) : null}
    </div>
  )
}
