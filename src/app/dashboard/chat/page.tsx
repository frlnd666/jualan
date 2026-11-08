import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import StaffDeniedCard from '@/components/dashboard/StaffDeniedCard'
import { redirect } from 'next/navigation'
import ChatReplyBox from '@/components/dashboard/ChatReplyBox'

interface ChatPageProps {
  searchParams: Promise<{
    session?: string
  }>
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const { session: activeSessionId } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fase 2: chat hanya untuk pemilik toko — staff tidak boleh masuk.
  const { data: chatProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if ((chatProfile as { role?: string } | null)?.role === 'staff') {
    return <StaffDeniedCard title="Chat" />
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) redirect('/dashboard/settings')

  // RLS membatasi hasil ke sesi milik toko user ini.
  const { data: sessions } = await supabase
    .from('chat_sessions')
    .select('id, buyer_name, buyer_phone, created_at, last_message_at')
    .eq('store_id', store.id)
    .order('last_message_at', { ascending: false })
    .limit(50)

  const sessionList = sessions ?? []
  const activeSession =
    sessionList.find((s) => s.id === activeSessionId) ?? null

  const { data: messages } = activeSession
    ? await supabase
        .from('chat_session_messages')
        .select('id, sender, body, created_at')
        .eq('session_id', activeSession.id)
        .order('created_at', { ascending: true })
        .limit(200)
    : { data: null }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Chat pembeli</h1>
        <p className="mt-1 text-sm text-gray-500">
          Percakapan dari widget chat di halaman tokomu. Halaman tersegarkan
          otomatis tiap beberapa detik.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="space-y-3">
          {sessionList.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-white px-5 py-8 text-center text-sm text-gray-500">
              Belum ada chat masuk. Widget chat sudah aktif di halaman tokomu.
            </div>
          ) : (
            sessionList.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/chat?session=${s.id}`}
                className={`block rounded-3xl border p-4 shadow-sm transition ${
                  activeSession?.id === s.id
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-gray-100 bg-white hover:bg-gray-50'
                }`}
              >
                <p className="font-semibold text-gray-900">{s.buyer_name}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {s.buyer_phone || 'Tanpa nomor WhatsApp'}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Aktivitas terakhir: {formatDateTime(s.last_message_at)}
                </p>
              </Link>
            ))
          )}
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          {!activeSession ? (
            <div className="flex h-full min-h-[240px] items-center justify-center text-center text-sm text-gray-400">
              Pilih percakapan di sebelah kiri untuk membaca dan membalas.
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="border-b border-gray-100 pb-3">
                <p className="font-bold text-gray-900">{activeSession.buyer_name}</p>
                <p className="text-xs text-gray-500">
                  {activeSession.buyer_phone || 'Tanpa nomor WhatsApp'} · Mulai{' '}
                  {formatDateTime(activeSession.created_at)}
                </p>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto py-4">
                {(messages ?? []).length === 0 ? (
                  <p className="py-6 text-center text-xs text-gray-400">
                    Belum ada pesan di sesi ini.
                  </p>
                ) : (
                  (messages ?? []).map((msg) => (
                    <div
                      key={msg.id}
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${
                        msg.sender === 'seller'
                          ? 'ml-auto bg-indigo-600 text-white'
                          : 'mr-auto bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p>{msg.body}</p>
                      <p
                        className={`mt-1 text-[10px] ${
                          msg.sender === 'seller' ? 'text-white/70' : 'text-gray-400'
                        }`}
                      >
                        {formatDateTime(msg.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-gray-100 pt-3">
                <ChatReplyBox sessionId={activeSession.id} />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
