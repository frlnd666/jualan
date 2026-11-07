import { redirect } from 'next/navigation'

type PaymentsPageProps = {
  searchParams: Promise<{
    orderId?: string
  }>
}

/**
 * Menu Pembayaran terpisah sudah dilebur ke Pesanan (UX-2): verifikasi
 * pembayaran kini dilakukan dari tab "Perlu verifikasi" dan halaman
 * detail pesanan. Route ini dipertahankan sebagai pengalih agar bookmark
 * dan link lama tetap sampai ke tempat yang benar.
 */
export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const { orderId } = await searchParams

  if (orderId) {
    redirect(`/dashboard/orders/${orderId}`)
  }

  redirect('/dashboard/orders?tab=perlu-verifikasi')
}
