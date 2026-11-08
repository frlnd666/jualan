// Halaman notifikasi seller (Fase 3) — daftar in-app untuk perubahan
// status order. Email/WhatsApp belum ada (TODO Fase 3, lihat README).
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listNotificationsAction } from '@/lib/actions/notifications'
import NotificationsList from '@/components/dashboard/NotificationsList'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { items } = await listNotificationsAction()

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Notifikasi</h1>
        <p className="mt-1 text-sm text-gray-600">
          Perubahan status pesananmu: pesanan baru, pembayaran terkonfirmasi,
          QRIS lunas, dan pengiriman.
        </p>
      </div>
      <NotificationsList items={items} emptyText="Belum ada notifikasi." />
    </div>
  )
}
