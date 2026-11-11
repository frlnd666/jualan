// Tombol "+" tambah cepat ke keranjang di kartu produk storefront
// (ala layar daftar di desain referensi). Satu ketuk = 1 item masuk
// keranjang; tampil centang sebentar sebagai umpan balik. Stok habis =
// tombol nonaktif.
'use client'

import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { useCart } from '@/lib/use-cart'
import type { Product } from '@/lib/types'

type QuickAddButtonProps = {
  product: Product
  storeSlug: string
}

export default function QuickAddButton({ product, storeSlug }: QuickAddButtonProps) {
  const addItem = useCart((state) => state.addItem)
  const [added, setAdded] = useState(false)
  const outOfStock = product.stock != null && Number(product.stock) <= 0

  function handleAdd() {
    if (outOfStock || added) return
    addItem(product, storeSlug, 1)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1200)
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={outOfStock}
      aria-label={outOfStock ? 'Stok habis' : `Tambah ${product.name} ke keranjang`}
      title={outOfStock ? 'Stok habis' : 'Tambah ke keranjang'}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-md transition active:scale-90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none ${
        added ? 'bg-emerald-600' : 'bg-[var(--primary)] hover:opacity-90'
      }`}
    >
      {added ? (
        <Check className="h-4 w-4" aria-hidden />
      ) : (
        <Plus className="h-4 w-4" aria-hidden />
      )}
    </button>
  )
}
