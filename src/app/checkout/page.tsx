'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/use-cart'
import { createOrderAction } from '@/lib/actions/checkout'
import { getAllowedPaymentMethodsAction } from '@/lib/actions/subscriptions'
import type { PaymentMethod, ShippingMethod } from '@/lib/types/order'
import { createClient } from '@/lib/supabase/client'

const CHECKOUT_STEPS = [
  { key: 1, label: 'Data & alamat' },
  { key: 2, label: 'Pengiriman' },
  { key: 3, label: 'Pembayaran' },
] as const

const PAYMENT_OPTIONS: {
  value: PaymentMethod
  label: string
  hint: string
}[] = [
  {
    value: 'BANK_TRANSFER',
    label: 'Transfer bank',
    hint: 'Detail rekening tujuan kamu terima dari penjual setelah pesanan dibuat; bukti transfer diupload di halaman invoice.',
  },
  {
    value: 'QRIS',
    label: 'QRIS',
    hint: 'Kode QR tujuan kamu terima dari penjual setelah pesanan dibuat; bukti pembayaran diupload di halaman invoice.',
  },
  {
    value: 'COD',
    label: 'COD (bayar di tempat)',
    hint: 'Bayar tunai ke kurir saat barang diterima. Tidak perlu upload bukti.',
  },
]

const inputClassName =
  'w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none ring-0 placeholder:text-neutral-400 focus:border-neutral-400'

export default function CheckoutPage() {
  const router = useRouter()
  const { items, subtotal, clearCart, storeId: cartStoreId } = useCart()

  const [step, setStep] = useState(1)

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
  // Metode pembayaran yang diizinkan paket toko (Fase 1): Free hanya COD.
  // Diambil dari server; penegakan yang mengikat tetap di createOrderAction.
  const [allowedMethods, setAllowedMethods] = useState<PaymentMethod[] | null>(null)

  const visiblePaymentOptions = useMemo(() => {
    if (!allowedMethods) return PAYMENT_OPTIONS
    return PAYMENT_OPTIONS.filter((o) => allowedMethods.includes(o.value))
  }, [allowedMethods])

  const [loadingShipping, setLoadingShipping] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  // Store diambil dari identitas yang disimpan cart saat produk ditambahkan
  // (fallback: store_id di produk pertama, untuk cart lama di localStorage).
  const storeId = cartStoreId || items[0]?.product.store_id || ''

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

    async function fetchAllowedMethods() {
      if (!storeId) return
      try {
        const allowed = await getAllowedPaymentMethodsAction(storeId)
        setAllowedMethods(allowed)
        // Bila metode yang terpilih tidak diizinkan paket toko (mis. toko
        // Free yang default-nya transfer), pindah ke metode pertama yang
        // diizinkan — untuk Free itu COD.
        if (allowed.length > 0) {
          setPaymentMethod((current) =>
            allowed.includes(current) ? current : allowed[0]
          )
        }
      } catch {
        // Gagal memuat = biarkan semua opsi tampil; server action yang
        // akan menolak metode yang tidak diizinkan.
      }
    }

    fetchShippingMethods()
    fetchAllowedMethods()
  }, [storeId])

  // Validasi per langkah — cerminan persis validasi server action, supaya
  // pembeli tidak menabrak error server di akhir alur.
  function validateStep(target: number): string {
    if (target === 1) {
      if (!customerName.trim()) return 'Nama lengkap wajib diisi.'
      if (!customerPhone.trim()) return 'Nomor WhatsApp wajib diisi.'
      if (!address.trim()) return 'Alamat lengkap wajib diisi.'
      if (!province.trim()) return 'Provinsi wajib diisi.'
      if (!city.trim()) return 'Kota wajib diisi.'
      if (!postalCode.trim()) return 'Kode pos wajib diisi.'
    }
    if (target === 2) {
      if (loadingShipping) return 'Metode pengiriman masih dimuat.'
      if (!shippingMethodId) return 'Pilih metode pengiriman terlebih dahulu.'
    }
    return ''
  }

  function goToStep(next: number) {
    if (next > step) {
      for (let s = step; s < next; s++) {
        const problem = validateStep(s)
        if (problem) {
          setErrorMessage(problem)
          setStep(s)
          return
        }
      }
    }
    setErrorMessage('')
    setStep(next)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function handleSubmit() {
    if (!items.length) {
      setErrorMessage('Cart masih kosong.')
      return
    }

    if (!storeId) {
      setErrorMessage('Store ID tidak ditemukan dari cart.')
      return
    }

    for (let s = 1; s <= 2; s++) {
      const problem = validateStep(s)
      if (problem) {
        setErrorMessage(problem)
        setStep(s)
        return
      }
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
              Tiga langkah singkat: data &amp; alamat, pengiriman, lalu pembayaran.
            </p>
          </div>

          {/* Indikator langkah — langkah selesai bisa diklik untuk kembali. */}
          <ol className="mb-6 flex items-center gap-2">
            {CHECKOUT_STEPS.map((s, index) => {
              const isActive = step === s.key
              const isDone = step > s.key
              return (
                <li key={s.key} className="flex flex-1 items-center gap-2">
                  <button
                    type="button"
                    disabled={!isDone}
                    onClick={() => isDone && goToStep(s.key)}
                    className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-neutral-900 text-white'
                        : isDone
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                        isActive
                          ? 'bg-white text-neutral-900'
                          : isDone
                            ? 'bg-emerald-500 text-white'
                            : 'bg-neutral-300 text-white'
                      }`}
                    >
                      {isDone ? '✓' : s.key}
                    </span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {index < CHECKOUT_STEPS.length - 1 ? (
                    <span aria-hidden className="h-px flex-1 bg-neutral-200" />
                  ) : null}
                </li>
              )
            })}
          </ol>

          {errorMessage ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {step === 1 ? (
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-neutral-900">
                Langkah 1 — Data &amp; alamat pengiriman
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-700">
                    Nama lengkap
                  </span>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className={inputClassName}
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
                    className={inputClassName}
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
                  className={inputClassName}
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
                    className={inputClassName}
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
                    className={inputClassName}
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
                    className={inputClassName}
                    placeholder="12345"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-700">
                  Catatan (opsional)
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className={inputClassName}
                  placeholder="Contoh: rumah pagar hitam, titip satpam, atau request khusus"
                />
              </label>

              <button
                type="button"
                onClick={() => goToStep(2)}
                className="w-full rounded-2xl bg-neutral-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Lanjut ke pengiriman
              </button>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-neutral-900">
                Langkah 2 — Metode pengiriman
              </h2>

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

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="rounded-2xl border border-neutral-200 bg-white px-5 py-3.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={() => goToStep(3)}
                  disabled={loadingShipping || !shippingMethodId}
                  className="flex-1 rounded-2xl bg-neutral-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Lanjut ke pembayaran
                </button>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-neutral-900">
                Langkah 3 — Metode pembayaran
              </h2>

              <div className="space-y-3">
                {visiblePaymentOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-4 transition ${
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
                      onChange={() => setPaymentMethod(option.value)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-neutral-900">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-neutral-500">
                        {option.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-600">
                Setelah pesanan dibuat, kamu langsung masuk ke halaman invoice:
                di sana ada ringkasan pesanan, status, dan tempat upload bukti
                pembayaran. Simpan link halaman itu — itu kunci pesananmu.
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="rounded-2xl border border-neutral-200 bg-white px-5 py-3.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="flex-1 rounded-2xl bg-neutral-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending
                    ? 'Memproses pesanan...'
                    : `Buat pesanan • Rp ${total.toLocaleString('id-ID')}`}
                </button>
              </div>
            </section>
          ) : null}
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
                <span>
                  Ongkir
                  {selectedShipping ? ` (${selectedShipping.name})` : ''}
                </span>
                <span>
                  {selectedShipping
                    ? `Rp ${shippingCost.toLocaleString('id-ID')}`
                    : 'Pilih di langkah 2'}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-neutral-200 pt-3 text-base font-bold text-neutral-900">
                <span>Total</span>
                <span>Rp {total.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <p className="text-xs leading-5 text-neutral-500">
              Langkah {step} dari 3 — {CHECKOUT_STEPS[step - 1].label}. Harga
              final selalu dihitung ulang oleh server dari database.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
