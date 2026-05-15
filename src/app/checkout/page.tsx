'use client'

import { useState, useEffect } from 'react'
import { useCart } from '@/lib/use-cart'
import { placeOrder } from '@/lib/actions/order'

export default function CheckoutPage() {
  const { items, subtotal, clearCart, storeSlug } = useCart()
  const [storeId, setStoreId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [address, setAddress] = useState('')
  const [province, setProvince] = useState('')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    ;(async () => {
      if (!storeSlug) return
      const res = await fetch(`/api/store-id?slug=${encodeURIComponent(storeSlug)}`)
      const data = await res.json()
      if (data.storeId) setStoreId(data.storeId)
    })()
  }, [storeSlug])

  async function handleSubmit() {
    if (!items.length || !storeId) return
    setLoading(true)

    await placeOrder({
      storeId,
      items: items.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        qty: i.qty,
        price: i.product.price,
      })),
      customerName,
      customerPhone,
      address,
      province,
      city,
      postalCode,
      shippingMethodName: 'Regular',
      shippingCost: 0,
      paymentMethod: 'bank_transfer',
    })

    clearCart()
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-xl mx-auto bg-white rounded-2xl p-4 space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Checkout</h1>
        <input value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm" placeholder="Nama lengkap" />
        <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm" placeholder="No WhatsApp" />
        <textarea value={address} onChange={e => setAddress(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm" rows={3} placeholder="Alamat" />
        <input value={province} onChange={e => setProvince(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm" placeholder="Provinsi" />
        <input value={city} onChange={e => setCity(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm" placeholder="Kota" />
        <input value={postalCode} onChange={e => setPostalCode(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm" placeholder="Kode pos" />
        <div className="border-t pt-3 flex items-center justify-between">
          <span className="text-sm text-gray-600">Total</span>
          <span className="font-bold">Rp {subtotal().toLocaleString('id-ID')}</span>
        </div>
        <button onClick={handleSubmit} disabled={loading} className="w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold disabled:opacity-50">
          {loading ? 'Memproses...' : 'Buat Pesanan'}
        </button>
      </div>
    </div>
  )
}