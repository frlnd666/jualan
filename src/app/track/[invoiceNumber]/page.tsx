import { redirect } from 'next/navigation'

type TrackPageProps = {
  params: Promise<{
    invoiceNumber: string
  }>
  searchParams: Promise<{
    t?: string
  }>
}

/**
 * Halaman tracking lama dilebur ke halaman invoice (UX-1): satu halaman
 * untuk invoice + status + pengiriman, supaya pembeli tidak berpindah
 * halaman untuk info yang sama. Route ini dipertahankan agar link lama
 * yang sudah tersebar tetap berfungsi — token diteruskan apa adanya dan
 * gerbang token tetap ditegakkan halaman invoice.
 */
export default async function TrackOrderPage({
  params,
  searchParams,
}: TrackPageProps) {
  const { invoiceNumber } = await params
  const { t } = await searchParams

  redirect(
    t
      ? `/invoice/${invoiceNumber}?t=${encodeURIComponent(t)}`
      : `/invoice/${invoiceNumber}`
  )
}
