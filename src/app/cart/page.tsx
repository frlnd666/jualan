'use client'

import Link from 'next/link'

export default function CartPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-xl mx-auto bg-white rounded-2xl p-4">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Cart</h1>
        <p className="text-sm text-gray-500 mb-4">Keranjang akan dihubungkan ke state cart berikutnya.</p>
        <Link href="/checkout" className="block text-center bg-indigo-600 text-white rounded-xl py-3 font-semibold">
          Lanjut Checkout
        </Link>
      </div>
    </div>
  )
}