'use client'

import { useState } from 'react'

export default function CheckoutPage() {
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-xl mx-auto bg-white rounded-2xl p-4 space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Checkout</h1>

        <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm" placeholder="Nama lengkap" />
        <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm" placeholder="No WhatsApp" />
        <textarea className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm" rows={3} placeholder="Alamat" />

        <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="qris">QRIS</option>
          <option value="cod">COD</option>
        </select>

        <button className="w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold">
          Buat Pesanan
        </button>
      </div>
    </div>
  )
}