'use client'

import { useEffect, useRef, useState } from 'react'
import {
  getChatMessages,
  sendChatMessage,
  startChatSession,
  type ChatMessageDTO,
} from '@/lib/actions/chat'
import { MessageCircle } from 'lucide-react'

interface StoreChatWidgetProps {
  storeId: string
  storeName: string
}

interface StoredSession {
  sessionId: string
  accessToken: string
  buyerName: string
}

export default function StoreChatWidget({ storeId, storeName }: StoreChatWidgetProps) {
  const storageKey = `jualan-chat-${storeId}`
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<StoredSession | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(storageKey)
      return raw ? (JSON.parse(raw) as StoredSession) : null
    } catch {
      return null
    }
  })
  const [messages, setMessages] = useState<ChatMessageDTO[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !session) return

    let cancelled = false

    async function poll() {
      // P2-14: poll jalan tiap 5 detik via setInterval — tanpa try/catch,
      // satu gagal fetch jadi unhandled rejection yang berulang tiap
      // 5 detik. Poll bersifat best-effort: gagal = diam, pesan lama
      // tetap tampil; error saat kirim/mulai chat tetap ditampilkan
      // oleh handleSend/handleStart.
      try {
        const result = await getChatMessages(session!.sessionId, session!.accessToken)
        if (!cancelled && result.success && result.messages) {
          setMessages(result.messages)
        }
      } catch {
        // Abaikan — polling berikutnya mencoba lagi.
      }
    }

    poll()
    const timer = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [open, session])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function handleStart(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')

    try {
      const result = await startChatSession({
        storeId,
        buyerName: name,
        buyerPhone: phone || undefined,
      })

      if (!result.success || !result.sessionId || !result.accessToken) {
        setError(result.error || 'Chat belum bisa dimulai.')
        return
      }

      const stored: StoredSession = {
        sessionId: result.sessionId,
        accessToken: result.accessToken,
        buyerName: name.trim(),
      }
      setSession(stored)
      try {
        localStorage.setItem(storageKey, JSON.stringify(stored))
      } catch {
        // Abaikan: sesi tetap aktif selama halaman terbuka.
      }
    } catch {
      // P1-05: action melempar — tombol tidak boleh nyangkut "Memulai...".
      setError('Gagal memulai chat. Periksa koneksi lalu coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !draft.trim()) return
    setBusy(true)
    setError('')

    try {
      const result = await sendChatMessage(session.sessionId, session.accessToken, draft)

      if (!result.success) {
        setError(result.error || 'Pesan gagal dikirim.')
        return
      }

      setDraft('')
      try {
        const refreshed = await getChatMessages(session.sessionId, session.accessToken)
        if (refreshed.success && refreshed.messages) setMessages(refreshed.messages)
      } catch {
        // P1-05: pesan sudah terkirim — refresh daftar gagal tidak boleh menampilkan error kirim.
        console.error('Gagal memuat ulang pesan chat.')
      }
    } catch {
      // P1-05: action melempar — tombol tidak boleh nyangkut disabled.
      setError('Gagal mengirim pesan. Periksa koneksi lalu coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(11,107,74,0.35)] transition hover:opacity-95 sm:right-6"
        aria-expanded={open}
      >
        <MessageCircle className="h-4 w-4" aria-hidden /> Chat toko
      </button>

      {open ? (
        <div className="fixed bottom-20 right-4 z-40 flex h-[480px] w-[min(92vw,360px)] flex-col overflow-hidden rounded-[24px] border border-black/10 bg-white shadow-[0_24px_48px_rgba(33,24,20,0.25)] sm:right-6">
          <div className="bg-[#2f241f] px-4 py-3 text-white">
            <p className="text-sm font-bold">{storeName}</p>
            <p className="text-xs text-white/70">
              {session ? `Chat sebagai ${session.buyerName}` : 'Mulai chat dengan penjual'}
            </p>
          </div>

          {!session ? (
            <form onSubmit={handleStart} className="flex flex-1 flex-col gap-3 p-4">
              <p className="text-sm text-[#7a6b5f]">
                Tulis nama kamu, lalu mulai bertanya soal produk, stok, atau pengiriman.
              </p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
                placeholder="Nama kamu"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={30}
                placeholder="Nomor WhatsApp (opsional)"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
              {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
              <button
                type="submit"
                disabled={busy || !name.trim()}
                className="mt-auto w-full rounded-xl bg-[var(--primary)] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? 'Memulai...' : 'Mulai chat'}
              </button>
            </form>
          ) : (
            <>
              <div className="flex-1 space-y-2 overflow-y-auto bg-[#faf7f3] p-3">
                {messages.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[#8d7f73]">
                    Belum ada pesan. Sapa penjual untuk mulai.
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-5 ${
                        msg.sender === 'buyer'
                          ? 'ml-auto bg-[var(--primary)] text-white'
                          : 'mr-auto border border-black/5 bg-white text-[#241b17]'
                      }`}
                    >
                      {msg.body}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={handleSend} className="border-t border-gray-100 p-3">
                {error ? (
                  <p className="mb-2 text-xs font-medium text-rose-600">{error}</p>
                ) : null}
                <div className="flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={2000}
                    placeholder="Tulis pesan..."
                    className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                  <button
                    type="submit"
                    disabled={busy || !draft.trim()}
                    className="shrink-0 rounded-xl bg-[#2f241f] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Kirim
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      ) : null}
    </>
  )
}
