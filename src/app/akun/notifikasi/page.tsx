// Halaman notifikasi pembeli (Fase 3) — status pesanan yang dibeli
// dengan akun ini. Tamu tidak punya akun, jadi tidak ada notifikasi.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listNotificationsAction } from '@/lib/actions/notifications'
import { getNotificationPreferencesAction } from '@/lib/actions/notification-preferences'
import NotificationsList from '@/components/dashboard/NotificationsList'
import NotificationPreferencesForm from '@/components/NotificationPreferencesForm'

export default async function BuyerNotificationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { items } = await listNotificationsAction()
  const { prefs, migrationMissing } = await getNotificationPreferencesAction()

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Notifikasi</h1>
        <p className="mt-1 text-sm text-gray-600">
          Kabar pesananmu: pembayaran terkonfirmasi, pengiriman, dan selesai.
        </p>
      </div>
      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
        <h2 className="text-base font-bold text-[var(--text)]">
          Pengaturan email &amp; WhatsApp
        </h2>
        <div className="mt-4">
          <NotificationPreferencesForm initial={prefs} migrationMissing={migrationMissing} />
        </div>
      </section>
      <NotificationsList
        items={items}
        emptyText="Belum ada notifikasi. Pesanan dengan akun ini akan muncul di sini."
      />
    </div>
  )
}
