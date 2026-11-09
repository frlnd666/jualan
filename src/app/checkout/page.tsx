// Halaman checkout — gate login di sisi server (checkout tamu ditutup).
// Tamu diarahkan daftar sebagai pembeli dulu, lalu kembali ke /checkout
// (param next). UI checkout-nya sendiri ada di komponen client
// CheckoutClient; penegakan yang mengikat ada di createOrderAction.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CheckoutClient from '@/components/checkout/CheckoutClient'

export default async function CheckoutPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/register?type=buyer&next=/checkout')
  }

  return <CheckoutClient />
}
