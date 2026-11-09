// Wizard onboarding toko (Fase 2, client): 5 langkah setelah register.
// Progress tersimpan di stores.onboarding_step — berhenti di tengah,
// buka lagi, wizard lanjut dari langkah terakhir yang tersimpan.
'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  finishOnboardingAction,
  getOnboardingStateAction,
  markOnboardingProductDoneAction,
  saveOnboardingPaymentAction,
  saveOnboardingShippingAction,
  saveOnboardingStoreAction,
  type OnboardingStore,
} from '@/lib/actions/onboarding'
import { createProductAction } from '@/lib/actions/subscriptions'
import { PartyPopper } from 'lucide-react'

const STEP_LABELS = [
  'Info toko',
  'Pembayaran',
  'Pengiriman',
  'Produk pertama',
  'Selesai',
]

const inputClass =
  'w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none focus:border-neutral-900'
const labelClass = 'mb-1 block text-sm font-medium text-neutral-700'

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

type ShipMethod = { name: string; price: string; estimatedDays: string }

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [store, setStore] = useState<OnboardingStore | null>(null)
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // Langkah 1
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  // Langkah 2
  const [bankName, setBankName] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [qrisImageUrl, setQrisImageUrl] = useState('')
  const [codEnabled, setCodEnabled] = useState(true)
  // Langkah 3
  const [origin, setOrigin] = useState('')
  const [methods, setMethods] = useState<ShipMethod[]>([
    { name: '', price: '', estimatedDays: '' },
  ])
  // Langkah 4
  const [productName, setProductName] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [productStock, setProductStock] = useState('10')
  const [productDescription, setProductDescription] = useState('')
  const [productImageUrl, setProductImageUrl] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const result = await getOnboardingStateAction()
        if ('error' in result) {
          setError(result.error)
          return
        }
        const s = result.store
        setStore(s)
        if (s) {
          setName(s.name)
          setSlug(s.slug)
          setSlugTouched(true)
          setDescription(s.description ?? '')
          setWhatsapp(s.whatsapp ?? '')
          setCity(s.city ?? '')
          setAddress(s.address ?? '')
          setBankName(s.bank_name ?? '')
          setBankAccountName(s.bank_account_name ?? '')
          setBankAccountNumber(s.bank_account_number ?? '')
          setQrisImageUrl(s.qris_image_url ?? '')
          setCodEnabled(s.cod_enabled ?? true)
          setOrigin(s.origin ?? '')
          const saved = Math.min(Math.max(s.onboarding_step, 0), 5)
          setStep(saved >= 5 ? 5 : saved + 1)
        }
      } catch {
        // P1-05: state gagal dimuat — jangan nyangkut "Memuat wizard...".
        setError('Gagal memuat wizard. Muat ulang halaman lalu coba lagi.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function saveStep1() {
    setError('')
    startTransition(async () => {
      const result = await saveOnboardingStoreAction({
        name,
        slug,
        description,
        whatsapp,
        city,
        address,
      })
      if ('error' in result) {
        setError(result.error)
        return
      }
      setStep(2)
    })
  }

  function saveStep2(skip = false) {
    setError('')
    startTransition(async () => {
      const result = await saveOnboardingPaymentAction({
        bankName: skip ? '' : bankName,
        bankAccountName: skip ? '' : bankAccountName,
        bankAccountNumber: skip ? '' : bankAccountNumber,
        qrisImageUrl: skip ? '' : qrisImageUrl,
        codEnabled: skip ? false : codEnabled,
      })
      if ('error' in result) {
        setError(result.error)
        return
      }
      setStep(3)
    })
  }

  function saveStep3() {
    setError('')
    startTransition(async () => {
      const result = await saveOnboardingShippingAction({
        origin,
        methods: methods.map((m) => ({
          name: m.name,
          price: Number(m.price.replace(/\D/g, '')) || 0,
          estimatedDays: m.estimatedDays,
        })),
      })
      if ('error' in result) {
        setError(result.error)
        return
      }
      setStep(4)
    })
  }

  function saveStep4() {
    setError('')
    startTransition(async () => {
      const result = await createProductAction({
        name: productName,
        slug: slugify(productName),
        price: Number(productPrice.replace(/\D/g, '')) || 0,
        stock: Number(productStock.replace(/\D/g, '')) || 0,
        description: productDescription,
        images: productImageUrl.trim() ? [productImageUrl.trim()] : [],
      })
      if ('error' in result) {
        setError(result.error ?? 'Gagal menyimpan produk.')
        return
      }
      await markOnboardingProductDoneAction()
      setStep(5)
    })
  }

  function skipStep4() {
    // Produk bisa ditambah nanti dari dashboard — wizard tetap selesai.
    startTransition(async () => {
      await finishOnboardingAction()
      setStep(5)
    })
  }

  function finish() {
    startTransition(async () => {
      await finishOnboardingAction()
      router.push('/dashboard')
    })
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl pt-6">
        <p className="text-sm text-[var(--text-muted)]">Memuat wizard...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 pt-6">
      <div>
        <p className="text-sm font-medium text-[var(--text-muted)]">
          Setup toko • Langkah {Math.min(step, 5)} dari 5
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">
          {step === 5 ? 'Tokomu sudah siap!' : 'Siapkan tokomu'}
        </h1>
        <div className="mt-4 flex gap-1.5">
          {STEP_LABELS.map((label, i) => (
            <div
              key={label}
              title={label}
              className={`h-2 flex-1 rounded-full ${
                i + 1 <= step ? 'bg-[var(--primary)]' : 'bg-[var(--line)]'
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {STEP_LABELS[Math.min(step, 5) - 1]}
        </p>
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <section className="space-y-4 rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
          <h2 className="text-base font-bold text-[var(--text)]">Info toko</h2>
          <div>
            <label className={labelClass}>Nama toko</label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!slugTouched) setSlug(slugify(e.target.value))
              }}
              className={inputClass}
              placeholder="Kopi Sore"
            />
          </div>
          <div>
            <label className={labelClass}>Slug (alamat toko)</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-muted)]">/&nbsp;</span>
              <input
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(slugify(e.target.value))
                }}
                className={inputClass}
                placeholder="kopi-sore"
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Deskripsi singkat</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="Ceritakan tokomu dalam satu-dua kalimat"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>WhatsApp toko</label>
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className={inputClass}
                inputMode="tel"
                placeholder="0812..."
              />
            </div>
            <div>
              <label className={labelClass}>Kota</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClass}
                placeholder="Kota Serang"
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Alamat toko</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="Jalan, nomor, kelurahan"
            />
          </div>
          <button
            type="button"
            onClick={saveStep1}
            disabled={isPending}
            className="w-full rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isPending ? 'Menyimpan...' : 'Simpan & lanjut ke pembayaran'}
          </button>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4 rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
          <h2 className="text-base font-bold text-[var(--text)]">
            Pembayaran toko
          </h2>
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            Isi salah satu: rekening bank untuk transfer, URL gambar QRIS,
            atau aktifkan COD. Bisa diubah nanti di Pengaturan.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Nama bank</label>
              <input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className={inputClass}
                placeholder="BCA / BRI / GoPay"
              />
            </div>
            <div>
              <label className={labelClass}>Nama pemilik rekening</label>
              <input
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                className={inputClass}
                placeholder="Nama di rekening"
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Nomor rekening</label>
            <input
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              className={inputClass}
              inputMode="numeric"
              placeholder="1234567890"
            />
          </div>
          <div>
            <label className={labelClass}>URL gambar QRIS (opsional)</label>
            <input
              value={qrisImageUrl}
              onChange={(e) => setQrisImageUrl(e.target.value)}
              className={inputClass}
              inputMode="url"
              placeholder="https://.../qris.jpg"
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={codEnabled}
              onChange={(e) => setCodEnabled(e.target.checked)}
            />
            Terima COD (bayar di tempat)
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => saveStep2(false)}
              disabled={isPending}
              className="flex-1 rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isPending ? 'Menyimpan...' : 'Simpan & lanjut'}
            </button>
            <button
              type="button"
              onClick={() => saveStep2(true)}
              disabled={isPending}
              className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text)]"
            >
              Lewati dulu
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4 rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
          <h2 className="text-base font-bold text-[var(--text)]">Pengiriman</h2>
          <div>
            <label className={labelClass}>Kota asal pengiriman</label>
            <input
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className={inputClass}
              placeholder="Kota Serang"
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">
              Metode pengiriman (opsional — bisa ditambah nanti)
            </p>
            <div className="space-y-3">
              {methods.map((m, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px] gap-2">
                  <input
                    value={m.name}
                    onChange={(e) =>
                      setMethods(
                        methods.map((x, j) =>
                          j === i ? { ...x, name: e.target.value } : x
                        )
                      )
                    }
                    className={inputClass}
                    placeholder="Mis. JNE REG / Ambil di toko"
                  />
                  <input
                    value={m.price}
                    onChange={(e) =>
                      setMethods(
                        methods.map((x, j) =>
                          j === i
                            ? { ...x, price: e.target.value.replace(/\D/g, '') }
                            : x
                        )
                      )
                    }
                    className={inputClass}
                    inputMode="numeric"
                    placeholder="Ongkir Rp"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setMethods([...methods, { name: '', price: '', estimatedDays: '' }])
              }
              className="mt-2 text-sm font-semibold text-[var(--primary)]"
            >
              + Tambah metode
            </button>
          </div>
          <button
            type="button"
            onClick={saveStep3}
            disabled={isPending}
            className="w-full rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isPending ? 'Menyimpan...' : 'Simpan & lanjut ke produk'}
          </button>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="space-y-4 rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
          <h2 className="text-base font-bold text-[var(--text)]">
            Produk pertama
          </h2>
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            Satu produk cukup untuk membuka toko. Produk lain bisa ditambah
            dari dashboard.
          </p>
          <div>
            <label className={labelClass}>Nama produk</label>
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className={inputClass}
              placeholder="Kopi Gula Aren 250g"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Harga (Rp)</label>
              <input
                value={productPrice}
                onChange={(e) =>
                  setProductPrice(e.target.value.replace(/\D/g, ''))
                }
                className={inputClass}
                inputMode="numeric"
                placeholder="25000"
              />
            </div>
            <div>
              <label className={labelClass}>Stok</label>
              <input
                value={productStock}
                onChange={(e) =>
                  setProductStock(e.target.value.replace(/\D/g, ''))
                }
                className={inputClass}
                inputMode="numeric"
                placeholder="10"
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Deskripsi</label>
            <textarea
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="Deskripsi singkat produk"
            />
          </div>
          <div>
            <label className={labelClass}>URL foto produk (opsional)</label>
            <input
              value={productImageUrl}
              onChange={(e) => setProductImageUrl(e.target.value)}
              className={inputClass}
              inputMode="url"
              placeholder="https://.../foto.jpg"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveStep4}
              disabled={isPending}
              className="flex-1 rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isPending ? 'Menyimpan...' : 'Simpan produk & selesaikan'}
            </button>
            <button
              type="button"
              onClick={skipStep4}
              disabled={isPending}
              className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text)]"
            >
              Lewati dulu
            </button>
          </div>
        </section>
      ) : null}

      {step === 5 && store ? (
        <section className="space-y-4 rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 text-center shadow-[var(--shadow-sm)]">
          <p className="flex justify-center">
            <PartyPopper className="h-10 w-10 text-[var(--primary)]" aria-hidden />
          </p>
          <h2 className="text-lg font-bold text-[var(--text)]">
            {store.name} sudah bisa dikunjungi!
          </h2>
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            Bagikan tautan tokomu ke pelanggan:
          </p>
          <Link
            href={`/${store.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block break-all rounded-2xl bg-[var(--surface-soft)] px-4 py-3 text-sm font-bold text-[var(--primary)]"
          >
            /{store.slug}
          </Link>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={finish}
              disabled={isPending}
              className="w-full rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Ke dashboard
            </button>
            <Link
              href="/dashboard/products/new"
              className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text)]"
            >
              Tambah produk lagi
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  )
}
