'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/use-cart'
import { createOrderAction } from '@/lib/actions/checkout'
import type { PaymentMethod, ShippingMethod } from '@/lib/types/order'
import { createClient } from '@/lib/supabase/client'

export default function CheckoutPage() {
  const router = useRouter()
  const { items, subtotal, clearCart } = useCart()

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [address, setAddress] = useState('')
  const [province, setProvince] = useState('')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [notes, setNotes] = useState('')

  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([])
  const [shippingMethodId, setShippingMethodId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER')

  const [loadingShipping, setLoadingShipping] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  const storeId = useMemo(() => {
    const firstItem = items[0]
    if (!firstItem) return ''

    return (
      firstItem.product.store_id ||
      firstItem.product.storeId ||
      firstItem.product.store?.id ||
      ''
    )
  }, [items])

  const selectedShipping = useMemo(() => {
    return shippingMethods.find((method) => method.id === shippingMethodId) || null
  }, [shippingMethods, shippingMethodId])

  const subtotalValue = subtotal()
  const shippingCost = selectedShipping ? Number(selectedShipping.price) : 0
  const total = subtotalValue + shippingCost

  useEffect(() => {
    async function fetchShippingMethods() {
      if (!storeId) {
        setLoadingShipping(false)
        return
      }

      setLoadingShipping(true)
      setErrorMessage('')

      const supabase = createClient()

      const { data, error } = await supabase
        .from('shipping_methods')
        .select('id, store_id, name, price, estimated_days, is_active, created_at')
        .eq('store_id', storeId)
        .eq('is_active', true)
        .order('price', { ascending: true })

      if (error) {
        setErrorMessage('Gagal memuat metode pengiriman.')
        setLoadingShipping(false)
        return
      }

      const methods = (data || []) as ShippingMethod[]
      setShippingMethods(methods)

      if (methods.length > 0) {
        setShippingMethodId(methods[0].id)
      }

      setLoadingShipping(false)
    }

    fetchShippingMethods()
  }, [storeId])

  async function handleSubmit() {
    if (!items.length) {
      setErrorMessage('Cart masih kosong.')
      return
    }

    if (!storeId) {
      setErrorMessage('Store ID tidak ditemukan dari cart.')
      return
    }

    if (!shippingMethodId) {
      setErrorMessage('Pilih metode pengiriman terlebih dahulu.')
      return
    }

    setErrorMessage('')

    startTransition(async () => {
      try {
        await createOrderAction({
          storeId,
          customerName,
          customerPhone,
          address,
          province,
          city,
          postalCode,
          notes,
          shippingMethodId,
          paymentMethod,
          items: items.map((item) => ({
            productId: item.product.id,
            productName: item.product.name,
            qty: item.qty,
            price: Number(item.product.price),
            notes: null,
          })),
        })

        clearCart()
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Terjadi kesalahan saat checkout.'
        setErrorMessage(message)
      }
    })
  }

  if (!items.length) {
    return (
      <div className="min-h-screen bg-neutral-50 px-4 py-10">
        <div className="mx-auto max-w-xl rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-neutral-900">Checkout</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Cart kamu masih kosong. Tambahkan produk dulu sebelum checkout.
          </p>
          <button
            onClick={() => router.push('/cart')}
            className="mt-6 rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white"
          >
            Kembali ke Cart
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-6 md:px-6">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-neutral-900">Checkout</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Lengkapi data pembeli, pilih pengiriman, lalu buat pesanan.
            </p>
          </div>

          {errorMessage ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="space-y-6">
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-neutral-900">Info customer</h2>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-700">
                    Nama lengkap
                  </span>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none ring-0 placeholder:text-neutral-400 focus:border-neutral-400"
                    placeholder="Nama lengkap"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-700">
                    No WhatsApp
                  </span>
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none ring-0 placeholder:text-neutral-400 focus:border-neutral-400"
                    placeholder="08xxxxxxxxxx"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-700">
                  Alamat lengkap
                </span>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none ring-0 placeholder:text-neutral-400 focus:border-neutral-400"
                  placeholder="Nama jalan, nomor rumah, RT/RW, kecamatan, kelurahan"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-700">
                    Provinsi
                  </span>
                  <input
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none ring-0 placeholder:text-neutral-400 focus:border-neutral-400"
                    placeholder="DKI Jakarta"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-700">
                    Kota
                  </span>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none ring-0 placeholder:text-neutral-400 focus:border-neutral-400"
                    placeholder="Jakarta Selatan"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-700">
                    Kode pos
                  </span>
                  <input
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none ring-0 placeholder:text-neutral-400 focus:border-neutral-400"
                    placeholder="12345"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-700">
                  Catatan
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none ring-0 placeholder:text-neutral-400 focus:border-neutral-400"
                  placeholder="Contoh: rumah pagar hitam, titip satpam, atau request khusus"
                />
              </label>
            </section>

            <section className="space-y-4 border-t border-neutral-200 pt-6">
              <h2 className="text-base font-semibold text-neutral-900">Metode pengiriman</h2>

              {loadingShipping ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                  Memuat metode pengiriman...
                </div>
              ) : shippingMethods.length === 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Belum ada metode pengiriman aktif untuk toko ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {shippingMethods.map((method) => (
                    <label
                      key={method.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-4 transition ${
                        shippingMethodId === method.id
                          ? 'border-neutral-900 bg-neutral-50'
                          : 'border-neutral-200 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="shippingMethod"
                        value={method.id}
                        checked={shippingMethodId === method.id}
                        onChange={() => setShippingMethodId(method.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-neutral-900">
                              {method.name}
                            </p>
                            <p className="text-xs text-neutral-500">
                              Estimasi {method.estimated_days || '-'}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-neutral-900">
                            Rp {Number(method.price).toLocaleString('id-ID')}
                          </p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4 border-t border-neutral-200 pt-6">
              <h2 className="text-base font-semibold text-neutral-900">Metode pembayaran</h2>

              <div className="space-y-3">
                {[
                  { value: 'BANK_TRANSFER', label: 'Transfer bank' },
                  { value: 'QRIS', label: 'QRIS' },
                  { value: 'COD', label: 'COD' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-4 transition ${
                      paymentMethod === option.value
                        ? 'border-neutral-900 bg-neutral-50'
                        : 'border-neutral-200 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={option.value}
                      checked={paymentMethod === option.value}
                      onChange={() => setPaymentMethod(option.value as PaymentMethod)}
                    />
                    <span className="text-sm font-medium text-neutral-800">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          </div>
        </div>

        <aside className="h-fit rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6 lg:sticky lg:top-6">
          <h2 className="text-lg font-bold text-neutral-900">Ringkasan pesanan</h2>

          <div className="mt-5 space-y-4">
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-start justify-between gap-3 rounded-2xl bg-neutral-50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold text-neutral-900">
                      {item.product.name}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {item.qty} x Rp {Number(item.product.price).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-neutral-900">
                    Rp {(Number(item.product.price) * item.qty).toLocaleString('id-ID')}
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t border-neutral-200 pt-4 text-sm">
              <div className="flex items-center justify-between text-neutral-600">
                <span>Subtotal</span>
                <span>Rp {subtotalValue.toLocaleString('id-ID')}</span>
              </div>

              <div className="flex items-center justify-between text-neutral-600">
                <span>Ongkir</span>
                <span>
                  {selectedShipping
                    ? `Rp ${shippingCost.toLocaleString('id-ID')}`
                    : '-'}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-neutral-200 pt-3 text-base font-bold text-neutral-900">
                <span>Total</span>
                <span>Rp {total.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isPending || loadingShipping || !shippingMethodId}
              className="w-full rounded-2xl bg-neutral-900 px-5 py-3.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? 'Memproses pesanan...' : 'Buat pesanan'}
            </button>

            <p className="text-xs leading-5 text-neutral-500">
              Setelah pesanan dibuat, customer akan diarahkan ke halaman invoice
              untuk melihat detail order dan instruksi pembayaran.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}