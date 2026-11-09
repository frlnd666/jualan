'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sendSellerMessage } from '@/lib/actions/chat-seller'

export default function ChatReplyBox({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // Segarkan thread berkala agar pesan pembeli baru muncul tanpa reload manual.
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 8000)
    return () => clearInterval(timer)
  }, [router])

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      try {
        const result = await sendSellerMessage(sessionId, draft)
        if (!result.success) {
          setError(result.error || 'Pesan gagal dikirim.')
          return
        }
        setDraft('')
        router.refresh()
      } catch {
        // P2-13: action melempar (mis. jaringan putus) — jangan biarkan
        // error naik ke error boundary; tampilkan inline.
        setError('Gagal mengirim pesan. Periksa koneksi lalu coba lagi.')
      }
    })
  }

  return (
    <form onSubmit={handleSend} className="space-y-2">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
          placeholder="Tulis balasan untuk pembeli..."
          className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={isPending || !draft.trim()}
          className="shrink-0 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? 'Mengirim...' : 'Kirim'}
        </button>
      </div>
      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
    </form>
  )
}
