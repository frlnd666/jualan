'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/use-cart'
import { createClient } from '@/lib/supabase/client'
import { storeHref } from '@/lib/store-links'
import { platformHosts, platformDomainFromEnv } from '@/lib/domains'

export default function CartPage() {
  const router = useRouter()
  const { items, updateQty, removeItem, subtotal, clearCart, storeSlug } = useCart()
  const [checkingAuth, setCheckingAuth] = useState(false)
  // Fase 5 — "Kembali ke toko" tetap di host yang melayani (domain
  // custom/subdomain = root, platform = /{slug}).
  const backHref = storeSlug
    ? storeHref(
        storeSlug,
        '/',
        platformHosts(
          platformDomainFromEnv(process.env.NEXT_PUBLIC_PLATFORM_DOMAIN)
        )
      )
    : '/'

  // Checkout wajib login: tamu diarahkan daftar sebagai pembeli dulu,
  // lalu kembali ke /checkout. Melihat isi keranjang tetap bebas.
  // Bila cek sesi gagal, biarkan halaman /checkout yang memutuskan
  // (gate server di sana mengarahkan tamu ke register).
  async function handleCheckoutClick() {
    setCheckingAuth(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      router.push(user ? '/checkout' : '/register?type=buyer&next=/checkout')
    } catch {
      router.push('/checkout')
    } finally {
      setCheckingAuth(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-28 md:pb-4">
      <div className="max-w-xl mx-auto bg-white rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900">Cart</h1>
          {storeSlug ? (
            <Link href={backHref} className="text-sm font-semibold text-indigo-600">
              ← Kembali ke toko
            </Link>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-gray-500">Cart masih kosong.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.product.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{item.product.name}</p>
                    <p className="text-sm text-gray-500">Rp {Number(item.product.price).toLocaleString('id-ID')}</p>
                  </div>
                  <button onClick={() => removeItem(item.product.id)} className="text-xs text-red-500">Hapus</button>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={() => updateQty(item.product.id, item.qty - 1)} className="w-8 h-8 rounded-lg border">-</button>
                  <span className="w-8 text-center">{item.qty}</span>
                  <button onClick={() => updateQty(item.product.id, Math.min(item.qty + 1, Number(item.product.stock ?? item.qty + 1)))} className="w-8 h-8 rounded-lg border">+</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t pt-3 flex items-center justify-between">
          <span className="text-sm text-gray-600">Subtotal</span>
          <span className="font-bold">Rp {subtotal().toLocaleString('id-ID')}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={clearCart} className="border border-gray-200 rounded-xl py-3 text-sm font-semibold">Kosongkan</button>
          <button
            type="button"
            onClick={handleCheckoutClick}
            disabled={checkingAuth}
            className="bg-indigo-600 text-white rounded-xl py-3 text-center text-sm font-semibold disabled:opacity-50"
          >
            {checkingAuth ? 'Memproses...' : 'Checkout'}
          </button>
        </div>
      </div>
    </div>
  )
}