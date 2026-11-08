// /akun tanpa subpath → arahkan ke riwayat pesanan.
import { redirect } from 'next/navigation'

export default function AkunIndexPage() {
  redirect('/akun/pesanan')
}
