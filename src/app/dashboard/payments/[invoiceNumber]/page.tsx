import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type PaymentDetailPageProps = {
  params: Promise<{
    invoiceNumber: string
  }>
}

/**
 * Detail pembayaran lama dilebur ke detail pesanan (UX-2). Route ini
 * menerjemahkan nomor invoice menjadi order-nya lalu mengalihkan ke sana;
 * kepemilikan tetap ditegakkan RLS (invoice toko lain tidak terbaca sesi
 * ini) dan halaman detail pesanan memeriksa store_id sekali lagi.
 */
export default async function PaymentDetailPage({
  params,
}: PaymentDetailPageProps) {
  const { invoiceNumber } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: invoice } = await supabase
    .from('invoices')
    .select('order_id')
    .eq('invoice_number', invoiceNumber)
    .maybeSingle()

  if (invoice?.order_id) {
    redirect(`/dashboard/orders/${invoice.order_id}`)
  }

  redirect('/dashboard/orders?tab=perlu-verifikasi')
}
