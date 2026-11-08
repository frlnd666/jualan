// Halaman notifikasi pembeli (Fase 3) — status pesanan yang dibeli
// dengan akun ini. Tamu tidak punya akun, jadi tidak ada notifikasi.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listNotificationsAction } from '@/lib/actions/notifications'
import NotificationsList from '@/components/dashboard/NotificationsList'

export default async function BuyerNotificationsPage() {
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
          Kabar pesananmu: pembayaran terkonfirmasi, pengiriman, dan selesai.
        </p>
      </div>
      <NotificationsList
        items={items}
        emptyText="Belum ada notifikasi. Pesanan dengan akun ini akan muncul di sini."
      />
    </div>
  )
}
