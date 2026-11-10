'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import Link from 'next/link'
import { useCart } from '@/lib/use-cart'
import { createOrderAction } from '@/lib/actions/checkout'
import { getCheckoutBootstrapAction } from '@/lib/actions/subscriptions'
import { validateVoucherCodeAction } from '@/lib/actions/vouchers'
import {
  calcShippingCost,
  formatWeight,
  totalWeightGrams,
} from '@/lib/shipping'
import {
  listBuyerAddressesAction,
  type BuyerAddress,
} from '@/lib/actions/buyer-addresses'
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
  'w-full rounded-2xl border border-[var(--line)] px-4 py-3 text-sm outline-none ring-0 placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]'

export default function CheckoutClient() {
  const router = useRouter()
  const { items, storeId: cartStoreId } = useCart()

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
  // Alamat tersimpan pembeli login (Fase 2): dipilih → mengisi form
  // langkah 1. Tamu tidak melihat bagian ini.
  const [savedAddresses, setSavedAddresses] = useState<BuyerAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  // Metode pembayaran yang diizinkan paket toko (Fase 1): Free hanya COD.
  // Diambil dari server; penegakan yang mengikat tetap di createOrderAction.
  const [allowedMethods, setAllowedMethods] = useState<PaymentMethod[] | null>(null)
  // Audit 2026-11-10 (W-5): tarif per-kg hanya untuk paket berbayar —
  // server meng-nol-kannya untuk Free; preview harus sama. Default
  // true (perilaku lama) sampai aturan toko termuat.
  const [perKgAllowed, setPerKgAllowed] = useState(true)
  // Voucher (Fase 3): kode divalidasi ke server; diskon tampil di
  // ringkasan. Penegakan final tetap di createOrderAction.
  const [voucherCode, setVoucherCode] = useState('')
  const [appliedVoucher, setAppliedVoucher] = useState<{
    code: string
    discount: number
  } | null>(null)
  const [voucherMessage, setVoucherMessage] = useState('')
  const [checkingVoucher, setCheckingVoucher] = useState(false)

  const visiblePaymentOptions = useMemo(() => {
    if (!allowedMethods) return PAYMENT_OPTIONS
    return PAYMENT_OPTIONS.filter((o) => allowedMethods.includes(o.value))
  }, [allowedMethods])

  const [loadingShipping, setLoadingShipping] = useState(true)

  // Fase 4 — harga promo flash sale aktif per produk (tampilan saja).
  const [flashPrices, setFlashPrices] = useState<Map<string, number>>(new Map())
  // Audit 2026-11-09: harga normal TERKINI dari DB per produk. Basis
  // preview harus sama dengan basis server — snapshot harga di
  // keranjang bisa basi (mis. sisa harga promo flash sale yang sudah
  // berakhir), dan preview yang lebih murah dari tagihan server adalah
  // pemicu sengketa harga.
  const [freshPrices, setFreshPrices] = useState<Map<string, number>>(new Map())
  const [errorMessage, setErrorMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  // Store diambil dari identitas yang disimpan cart saat produk ditambahkan
  // (fallback: store_id di produk pertama, untuk cart lama di localStorage).
  const storeId = cartStoreId || items[0]?.product.store_id || ''

  const selectedShipping = useMemo(() => {
    return shippingMethods.find((method) => method.id === shippingMethodId) || null
  }, [shippingMethods, shippingMethodId])

  const subtotalValue = useMemo(() => {
    // Fase 4 — preview harga flash sale: harga promo aktif menggantikan
    // harga normal TERKINI dari DB (bukan snapshot keranjang; lihat
    // freshPrices). Harga yang mengikat dihitung server dari database
    // di createOrderAction — preview ini sekarang memakai basis sama.
    return items.reduce((sum, item) => {
      const base = freshPrices.get(item.product.id) ?? Number(item.product.price)
      const promo = flashPrices.get(item.product.id)
      const price = promo !== undefined && promo > 0 && promo < base ? promo : base
      return sum + price * item.qty
    }, 0)
  }, [items, flashPrices, freshPrices])
  // Fase 3: total berat keranjang + ongkir berbasis berat (harga dasar +
  // per kg di atas berat dasar). Harga yang mengikat tetap dihitung
  // server dari database — ini hanya preview.
  const totalWeightGram = useMemo(
    () =>
      totalWeightGrams(
        items.map((item) => ({ weightGram: item.product.weight_gram, qty: item.qty }))
      ),
    [items]
  )
  const shippingCost = selectedShipping
    ? calcShippingCost(
        {
          basePrice: Number(selectedShipping.price),
          perKgPrice: perKgAllowed
            ? Number(selectedShipping.per_kg_price ?? 0)
            : 0,
          baseWeightGram: Number(selectedShipping.base_weight_gram ?? 1000),
        },
        totalWeightGram
      )
    : 0
  const voucherDiscount = appliedVoucher?.discount ?? 0
  const total = subtotalValue - voucherDiscount + shippingCost

  useEffect(() => {
    async function fetchShippingMethods() {
      if (!storeId) {
        setLoadingShipping(false)
        return
      }

      setLoadingShipping(true)
      setErrorMessage('')

      try {
        const supabase = createClient()

        // Fase 3: kolom tarif per-kg dibaca bila ada; bila migrasi f3 belum
        // dijalankan, ulangi dengan kolom lama (ongkir = harga dasar).
        const full = await supabase
          .from('shipping_methods')
          .select('id, store_id, name, price, estimated_days, is_active, created_at, courier_code, per_kg_price, base_weight_gram')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .order('price', { ascending: true })

        let data: ShippingMethod[] | null = full.data as ShippingMethod[] | null
        let error = full.error
        if (error && /per_kg_price|courier_code|base_weight_gram/.test(error.message || '')) {
          const legacy = await supabase
            .from('shipping_methods')
            .select('id, store_id, name, price, estimated_days, is_active, created_at')
            .eq('store_id', storeId)
            .eq('is_active', true)
            .order('price', { ascending: true })
          data = legacy.data as ShippingMethod[] | null
          error = legacy.error
        }

        if (error) {
          setErrorMessage('Gagal memuat metode pengiriman.')
          return
        }

        const methods = (data || []) as ShippingMethod[]
        setShippingMethods(methods)

        if (methods.length > 0) {
          setShippingMethodId(methods[0].id)
        }
      } catch {
        // P1-05: supabase-js melempar saat fetch jaringan gagal — jangan nyangkut di jalur checkout.
        setErrorMessage('Gagal memuat metode pengiriman.')
      } finally {
        setLoadingShipping(false)
      }
    }

    async function fetchAllowedMethods() {
      if (!storeId) return
      try {
        // Performa 2026-11-10: SATU action bootstrap untuk aturan
        // per-kg + metode yang diizinkan (sebelumnya dua action
        // berurutan yang sama-sama memuat langganan di server).
        const bootstrap = await getCheckoutBootstrapAction(storeId)
        setPerKgAllowed(bootstrap.perKgAllowed)
        const allowed = bootstrap.allowedMethods
        // Array kosong dari bootstrap berarti gagal baca (fail-closed
        // di server) — jangan kunci UI; biarkan semua opsi tampil dan
        // server action yang menolak metode yang tidak diizinkan.
        if (allowed.length === 0) return
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

  // Fase 4 — muat flash sale aktif toko untuk preview harga promo.
  // Policy publik hanya membaca yang aktif + di dalam jadwal; bila
  // tabel belum ada (migrasi f4 belum dijalankan), abaikan.
  useEffect(() => {
    async function fetchFlashSales() {
      if (!storeId) return
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('flash_sales')
          .select('product_id, promo_price, starts_at, ends_at, is_active')
          .eq('store_id', storeId)
          .eq('is_active', true)
        if (error || !data) return
        const now = new Date().getTime()
        const map = new Map<string, number>()
        for (const row of data as Array<{
          product_id: string
          promo_price: number
          starts_at: string
          ends_at: string
          is_active: boolean
        }>) {
          const start = new Date(row.starts_at).getTime()
          const end = new Date(row.ends_at).getTime()
          if (Number.isNaN(start) || Number.isNaN(end)) continue
          if (now < start || now > end) continue
          const promo = Math.floor(Number(row.promo_price) || 0)
          if (promo > 0) map.set(row.product_id, promo)
        }
        setFlashPrices(map)
      } catch {
        // Tanpa flash sale = harga normal.
      }
    }
    fetchFlashSales()
  }, [storeId])

  // Audit 2026-11-09: muat harga normal terkini produk di keranjang
  // dari DB (basis preview yang sama dengan server).
  useEffect(() => {
    async function fetchFreshPrices() {
      if (!storeId || items.length === 0) return
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('products')
          .select('id, price')
          .eq('store_id', storeId)
          .in(
            'id',
            items.map((item) => item.product.id)
          )
        if (error || !data) return
        const map = new Map<string, number>()
        for (const row of data as Array<{ id: string; price: number }>) {
          map.set(row.id, Number(row.price))
        }
        setFreshPrices(map)
      } catch {
        // Gagal memuat = preview memakai snapshot keranjang (perilaku lama).
      }
    }
    fetchFreshPrices()
    // Sengaja hanya bergantung pada storeId + daftar id produk.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, items.map((item) => item.product.id).join(',')])

  // Fase 2: pembeli login — muat buku alamat; alamat utama mengisi
  // form secara otomatis bila form masih kosong.
  useEffect(() => {
    async function fetchSavedAddresses() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      try {
        const addresses = await listBuyerAddressesAction()
        setSavedAddresses(addresses)
        const main = addresses.find((a) => a.is_default) ?? addresses[0]
        if (main) {
          setSelectedAddressId(main.id)
          setCustomerName((v) => v || main.recipient_name)
          setCustomerPhone((v) => v || main.phone)
          setAddress((v) => v || main.address)
          setProvince((v) => v || main.province)
          setCity((v) => v || main.city)
          setPostalCode((v) => v || main.postal_code)
        }
      } catch {}
    }
    fetchSavedAddresses()
  }, [])

  function applySavedAddress(id: string) {
    setSelectedAddressId(id)
    const chosen = savedAddresses.find((a) => a.id === id)
    if (!chosen) return
    setCustomerName(chosen.recipient_name)
    setCustomerPhone(chosen.phone)
    setAddress(chosen.address)
    setProvince(chosen.province)
    setCity(chosen.city)
    setPostalCode(chosen.postal_code)
  }

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

  async function applyVoucher() {
    if (!storeId || !voucherCode.trim()) {
      setVoucherMessage('Masukkan kode voucher dulu.')
      return
    }
    setCheckingVoucher(true)
    setVoucherMessage('')
    try {
      const result = await validateVoucherCodeAction(
        storeId,
        voucherCode,
        subtotalValue
      )
      if (result.ok) {
        setAppliedVoucher({ code: result.code ?? voucherCode.toUpperCase(), discount: result.discount })
        setVoucherMessage(
          `Voucher ${result.code} dipakai — hemat Rp ${result.discount.toLocaleString('id-ID')}.`
        )
      } else {
        setAppliedVoucher(null)
        setVoucherMessage(result.error ?? 'Kode voucher tidak valid.')
      }
    } catch {
      setVoucherMessage('Gagal memeriksa voucher. Coba lagi.')
    } finally {
      setCheckingVoucher(false)
    }
  }

  function removeVoucher() {
    setAppliedVoucher(null)
    setVoucherCode('')
    setVoucherMessage('')
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

    // Keranjang TIDAK dibersihkan di sini. Dua alasan (bug 2026-11-09):
    //  (1) clearCart() SEBELUM await membuat halaman langsung
    //      menampilkan "Cart masih kosong" selama action berjalan
    //      (8-13 dtk) — pembeli mengira checkout gagal lalu mengulang,
    //      dan terbentuk pesanan duplikat.
    //  (2) redirect() di akhir createOrderAction melempar NEXT_REDIRECT;
    //      bila tertelan catch di bawah, navigasi ke invoice tidak
    //      terjadi dan pembeli terjebak di /checkout. Keranjang
    //      dibersihkan di halaman invoice (?baru=1) yang hanya tercapai
    //      bila pesanan sudah terbentuk (ClearCartOnSuccess).
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
          voucherCode: appliedVoucher?.code,
          items: items.map((item) => ({
            productId: item.product.id,
            productName: item.product.name,
            qty: item.qty,
            price: Number(item.product.price),
            notes: null,
          })),
        })
      } catch (error) {
        // redirect() sukses = navigasi ke invoice — lempar ulang supaya
        // router menjalankannya; hanya error beneran yang ditampilkan,
        // dengan keranjang tetap utuh supaya pembeli bisa coba lagi.
        if (isRedirectError(error)) throw error
        const message =
          error instanceof Error ? error.message : 'Terjadi kesalahan saat checkout.'
        setErrorMessage(message)
      }
    })
  }

  if (!items.length) {
    return (
      <div className="min-h-screen bg-[var(--bg)] px-4 py-10">
        <div className="mx-auto max-w-xl rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-[var(--text)]">Checkout</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Cart kamu masih kosong. Tambahkan produk dulu sebelum checkout.
          </p>
          <button
            onClick={() => router.push('/cart')}
            className="mt-6 rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white"
          >
            Kembali ke Cart
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-6 md:px-6">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm md:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--text)]">Checkout</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
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
                        ? 'bg-[var(--primary)] text-white'
                        : isDone
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-[var(--surface-soft)] text-[var(--text-muted)]'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                        isActive
                          ? 'bg-[var(--surface)] text-[var(--text)]'
                          : isDone
                            ? 'bg-emerald-500 text-white'
                            : 'bg-[var(--stone)] text-white'
                      }`}
                    >
                      {isDone ? '✓' : s.key}
                    </span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {index < CHECKOUT_STEPS.length - 1 ? (
                    <span aria-hidden className="h-px flex-1 bg-[var(--line)]" />
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
              <h2 className="text-base font-semibold text-[var(--text)]">
                Langkah 1 — Data &amp; alamat pengiriman
              </h2>

              {savedAddresses.length > 0 ? (
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[var(--text)]">
                      Pakai alamat tersimpan
                    </span>
                    <select
                      value={selectedAddressId}
                      onChange={(e) => applySavedAddress(e.target.value)}
                      className={inputClassName}
                    >
                      {savedAddresses.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label} — {a.recipient_name}, {a.city}
                          {a.is_default ? ' (utama)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Link
                    href="/akun/alamat"
                    className="mt-2 inline-block text-xs font-semibold text-[var(--text)] underline"
                  >
                    Kelola buku alamat
                  </Link>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[var(--text)]">
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
                  <span className="mb-2 block text-sm font-medium text-[var(--text)]">
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
                <span className="mb-2 block text-sm font-medium text-[var(--text)]">
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
                  <span className="mb-2 block text-sm font-medium text-[var(--text)]">
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
                  <span className="mb-2 block text-sm font-medium text-[var(--text)]">
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
                  <span className="mb-2 block text-sm font-medium text-[var(--text)]">
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
                <span className="mb-2 block text-sm font-medium text-[var(--text)]">
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
                className="w-full rounded-2xl bg-[var(--primary)] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)]"
              >
                Lanjut ke pengiriman
              </button>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-[var(--text)]">
                Langkah 2 — Metode pengiriman
              </h2>

              {loadingShipping ? (
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text-muted)]">
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
                          ? 'border-[var(--primary)] bg-[var(--surface-soft)]'
                          : 'border-[var(--line)] bg-[var(--surface)]'
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
                            <p className="text-sm font-semibold text-[var(--text)]">
                              {method.name}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">
                              Estimasi {method.estimated_days || '-'}
                              {method.courier_code ? ` • ${method.courier_code}` : ''}
                            </p>
                            {perKgAllowed && Number(method.per_kg_price ?? 0) > 0 ? (
                              <p className="text-xs text-[var(--text-muted)]">
                                Termasuk {formatWeight(Number(method.base_weight_gram ?? 1000))} pertama,
                                lalu + Rp{' '}
                                {Number(method.per_kg_price).toLocaleString('id-ID')}/kg
                              </p>
                            ) : null}
                          </div>
                          <p className="text-sm font-semibold text-[var(--text)]">
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
                  className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-3.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-soft)]"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={() => goToStep(3)}
                  disabled={loadingShipping || !shippingMethodId}
                  className="flex-1 rounded-2xl bg-[var(--primary)] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Lanjut ke pembayaran
                </button>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-[var(--text)]">
                Langkah 3 — Metode pembayaran
              </h2>

              {/* Voucher (Fase 3) */}
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[var(--text)]">
                    Kode voucher (opsional)
                  </span>
                  {appliedVoucher ? (
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <p className="text-sm font-semibold text-emerald-800">
                        {appliedVoucher.code} — hemat Rp{' '}
                        {appliedVoucher.discount.toLocaleString('id-ID')}
                      </p>
                      <button
                        type="button"
                        onClick={removeVoucher}
                        className="text-xs font-semibold text-emerald-700 underline"
                      >
                        Hapus
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={voucherCode}
                        onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                        className={inputClassName}
                        placeholder="Contoh: HEMAT10"
                      />
                      <button
                        type="button"
                        onClick={applyVoucher}
                        disabled={checkingVoucher}
                        className="shrink-0 rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {checkingVoucher ? 'Memeriksa...' : 'Pakai'}
                      </button>
                    </div>
                  )}
                </label>
                {voucherMessage ? (
                  <p
                    className={`mt-2 text-xs font-medium ${
                      appliedVoucher ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {voucherMessage}
                  </p>
                ) : null}
              </div>

              <div className="space-y-3">
                {visiblePaymentOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-4 transition ${
                      paymentMethod === option.value
                        ? 'border-[var(--primary)] bg-[var(--surface-soft)]'
                        : 'border-[var(--line)] bg-[var(--surface)]'
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
                      <span className="block text-sm font-semibold text-[var(--text)]">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-[var(--text-muted)]">
                        {option.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
                Setelah pesanan dibuat, kamu langsung masuk ke halaman invoice:
                di sana ada ringkasan pesanan, status, dan tempat upload bukti
                pembayaran. Simpan link halaman itu — itu kunci pesananmu.
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-3.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-soft)]"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="flex-1 rounded-2xl bg-[var(--primary)] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending
                    ? 'Memproses pesanan...'
                    : `Buat pesanan • Rp ${total.toLocaleString('id-ID')}`}
                </button>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="h-fit rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm md:p-6 lg:sticky lg:top-6">
          <h2 className="text-lg font-bold text-[var(--text)]">Ringkasan pesanan</h2>

          <div className="mt-5 space-y-4">
            <div className="space-y-3">
              {items.map((item) => {
                const base =
                  freshPrices.get(item.product.id) ?? Number(item.product.price)
                const promo = flashPrices.get(item.product.id)
                const effective =
                  promo !== undefined && promo > 0 && promo < base ? promo : base
                const onFlash = effective < base
                return (
                  <div
                    key={item.product.id}
                    className="flex items-start justify-between gap-3 rounded-2xl bg-[var(--surface-soft)] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-semibold text-[var(--text)]">
                        {item.product.name}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {item.qty} x{' '}
                        {onFlash ? (
                          <>
                            <span className="line-through">
                              Rp {base.toLocaleString('id-ID')}
                            </span>{' '}
                            <span className="font-semibold text-red-600">
                              Rp {effective.toLocaleString('id-ID')}
                            </span>{' '}
                            <span className="font-semibold text-red-600">
                              FLASH SALE
                            </span>
                          </>
                        ) : (
                          <>Rp {base.toLocaleString('id-ID')}</>
                        )}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-[var(--text)]">
                      Rp {(effective * item.qty).toLocaleString('id-ID')}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="space-y-3 border-t border-[var(--line)] pt-4 text-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span>Subtotal</span>
                <span>Rp {subtotalValue.toLocaleString('id-ID')}</span>
              </div>

              {voucherDiscount > 0 ? (
                <div className="flex items-center justify-between text-emerald-700">
                  <span>Diskon voucher ({appliedVoucher?.code})</span>
                  <span>− Rp {voucherDiscount.toLocaleString('id-ID')}</span>
                </div>
              ) : null}

              <div className="flex items-center justify-between text-[var(--text-muted)]">
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

              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span>Total berat</span>
                <span>{formatWeight(totalWeightGram)}</span>
              </div>

              <div className="flex items-center justify-between border-t border-[var(--line)] pt-3 text-base font-bold text-[var(--text)]">
                <span>Total</span>
                <span>Rp {total.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <p className="text-xs leading-5 text-[var(--text-muted)]">
              Langkah {step} dari 3 — {CHECKOUT_STEPS[step - 1].label}. Harga
              final selalu dihitung ulang oleh server dari database.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
