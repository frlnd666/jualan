'use client'

import { useState } from 'react'
import { useCart } from '@/lib/use-cart'
import Link from 'next/link'

export default function ProductDetailClient({ storeSlug, product }: { storeSlug: string; product: any }) {
  const addItem = useCart((s) => s.addItem)
  const [loading, setLoading] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-2xl mx-auto bg-white">
        {product.images?.[0] && <img src={product.images[0]} alt={product.name} className="w-full h-80 object-cover" />}
        <div className="p-4 space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            <p className="text-xl font-bold text-indigo-600 mt-2">Rp {Number(product.price).toLocaleString('id-ID')}</p>
          </div>
          <p className="text-sm text-gray-600">{product.description}</p>
          <button onClick={() => addItem(product, storeSlug)} className="block w-full text-center bg-indigo-600 text-white rounded-xl py-3 font-semibold">
            Tambah ke Cart
          </button>
          <Link href="/cart" className="block text-center border border-gray-200 rounded-xl py-3 font-semibold">
            Lihat Cart
          </Link>
        </div>
      </div>
    </div>
  )
}