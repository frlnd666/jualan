// Tombol keranjang di banner toko — pengganti tombol "Kembali".
// Client component kecil: halaman toko adalah server component, jadi
// badge jumlah item dibaca dari store zustand (localStorage) di sini.
'use client'

import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { cartTotalQty, useCart } from '@/lib/use-cart'

export default function StoreCartButton() {
  const count = useCart((state) => cartTotalQty(state.items))

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Keranjang, ${count} item` : 'Keranjang'}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition hover:bg-white/15"
    >
      <ShoppingCart size={18} strokeWidth={2} />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold leading-none text-white">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  )
}
