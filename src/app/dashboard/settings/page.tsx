'use client'

import Link from 'next/link'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import StaffDeniedCard from '@/components/dashboard/StaffDeniedCard'
import { uploadToCloudinary } from '@/lib/cloudinary'
import { normalizeStoreSlug, validateStoreSlug } from '@/lib/store-slug'
import { ensureStoreSubscription } from '@/lib/actions/subscriptions'
import { TRIAL_ALREADY_USED_MESSAGE } from '@/lib/subscriptions'
import {
  getStorePaymentAction,
  saveStorePaymentAction,
} from '@/lib/actions/store-payment'
import ShopeePaySettingsForm from '@/components/dashboard/ShopeePaySettingsForm'
import { clearStoredPlan, readStoredPlan } from '@/lib/register-plan'
import { useRouter } from 'next/navigation'

type SectionKey = 'profil' | 'kontak' | 'tampilan' | 'pembayaran'

const inputClassName =
  'w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]'

function SectionCard({
  title,
  description,
  children,
  onSave,
  saving,
  saved,
  error,
  saveLabel = 'Simpan bagian ini',
}: {
  title: string
  description: string
  children: React.ReactNode
  onSave: () => void
  saving: boolean
  saved: boolean
  error: string
  saveLabel?: string
}) {
  return (
    <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
      <h2 className="text-base font-bold text-[var(--text)]">{title}</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>

      <div className="mt-5 space-y-4">{children}</div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {saved && !error ? (
        <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Tersimpan ✓
        </p>
      ) : null}

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="mt-5 w-full rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {saving ? 'Menyimpan...' : saveLabel}
      </button>
    </section>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-[var(--text)]">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-2 block text-xs text-[var(--text-muted)]">
          {hint}
        </span>
      ) : null}
    </label>
  )
}

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [instagram, setInstagram] = useState('')
  const [theme, setTheme] = useState('default')
  const [logoUrl, setLogoUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')

  // K-05 — bagian Pembayaran (sama seperti langkah 2 wizard onboarding).
  // paymentReady menandakan prefill dari server action sudah berhasil:
  // tombol simpan diblokir sampai data termuat, supaya simpan dengan
  // form kosong tidak menghapus rekening yang sudah tersimpan.
  const [bankName, setBankName] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [qrisImageUrl, setQrisImageUrl] = useState('')
  const [codEnabled, setCodEnabled] = useState(true)
  const [paymentReady, setPaymentReady] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  const [savingSection, setSavingSection] = useState<SectionKey | null>(null)
  const [savedSection, setSavedSection] = useState<SectionKey | null>(null)
  const [sectionError, setSectionError] = useState<{
    section: SectionKey
    message: string
  } | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        // Fase 2: pengaturan hanya untuk pemilik toko — staff ditolak di
        // sini (dan di RLS: policy stores owner-only).
        const { data: settingsProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        if ((settingsProfile as { role?: string } | null)?.role === 'staff') {
          setDenied(true)
          return
        }

        const { data: store } = await supabase
          .from('stores')
          // Daftar kolom eksplisit, BUKAN '*' (K-03): '*' di PostgREST
          // bisa mengembang ke kolom yang sudah dicabut hak SELECT-nya
          // (cache skema basi) sehingga baca toko gagal total.
          .select(
            'id, name, slug, description, whatsapp, city, address, instagram, theme, logo_url, banner_url, onboarding_step'
          )
          .eq('owner_id', user.id)
          .single()

        if (store) {
          setStoreId(store.id)
          setOnboardingStep(
            typeof store.onboarding_step === 'number' ? store.onboarding_step : 5
          )
          setName(store.name)
          setSlug(store.slug)
          setDescription(store.description ?? '')
          setWhatsapp(store.whatsapp ?? '')
          setCity(store.city ?? '')
          setAddress(store.address ?? '')
          setInstagram(store.instagram ?? '')
          setTheme(store.theme)
          setLogoUrl(store.logo_url ?? '')
          setBannerUrl(store.banner_url ?? '')
          // Toko lama (dari sebelum Fase 1) belum punya baris langganan:
          // buatkan Free/ACTIVE sekali secara diam-diam + naikkan peran
          // jadi seller. Idempotent — toko yang sudah punya baris tidak
          // disentuh.
          void ensureStoreSubscription(store.id, 'free')

          // K-05 — muat rekening lewat server action: client anon tidak
          // bisa membaca kolom rekening sejak K-03, jadi prefill bagian
          // Pembayaran harus lewat service_role (action memverifikasi
          // pemilik dulu). Gagal muat = form kosong + simpan diblokir
          // (lihat savePembayaran), bukan diam-diam menimpa data lama.
          const pay = await getStorePaymentAction()
          if ('payment' in pay && pay.payment) {
            setBankName(pay.payment.bank_name ?? '')
            setBankAccountName(pay.payment.bank_account_name ?? '')
            setBankAccountNumber(pay.payment.bank_account_number ?? '')
            setQrisImageUrl(pay.payment.qris_image_url ?? '')
            setCodEnabled(pay.payment.cod_enabled ?? true)
            setPaymentReady(true)
          } else if ('error' in pay) {
            setPaymentError(pay.error)
          }
        }
      } catch (e) {
        // P1-05: load gagal (mis. jaringan putus) — jangan nyangkut "Memuat...".
        console.error('Gagal memuat pengaturan toko:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleUpload(file: File, type: 'logo' | 'banner') {
    // P2-14: uploadToCloudinary melempar saat jaringan gagal — tanpa
    // try/catch jadi unhandled rejection dari onChange input file.
    // Pesan tampil di seksi Tampilan (tempat logo/banner berada).
    try {
      const url = await uploadToCloudinary(file)
      if (type === 'logo') setLogoUrl(url)
      else setBannerUrl(url)
    } catch {
      setSectionError({
        section: 'tampilan',
        message: 'Gagal mengunggah gambar. Periksa koneksi lalu coba lagi.',
      })
    }
  }

  function fullPayload(userId: string) {
    return {
      owner_id: userId,
      name,
      slug: normalizeStoreSlug(slug),
      description,
      whatsapp,
      city: city.trim() || null,
      address: address.trim() || null,
      instagram: instagram.trim().replace(/^@/, '') || null,
      theme,
      logo_url: logoUrl,
      banner_url: bannerUrl,
    }
  }

  /**
   * Simpan per bagian: toko yang sudah ada hanya di-update kolom bagiannya;
   * toko baru (belum pernah disimpan) dibuat sekali dengan seluruh isian
   * form saat bagian mana pun pertama kali disimpan.
   */
  async function saveSection(
    section: SectionKey,
    partial: Record<string, unknown>
  ) {
    setSavingSection(section)
    setSavedSection(null)
    setSectionError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setSectionError({
          section,
          message: 'Sesi login tidak ditemukan. Silakan login ulang.',
        })
        return
      }

      let saveError: { code?: string; message: string } | null = null

      if (storeId) {
        const { error } = await supabase
          .from('stores')
          .update(partial)
          .eq('id', storeId)
          .eq('owner_id', user.id)
        saveError = error
      } else {
        const { data, error } = await supabase
          .from('stores')
          .insert(fullPayload(user.id))
          .select('id')
          .single()
        saveError = error
        if (data) {
          setStoreId(data.id)
          // Toko baru: buat baris langganan sesuai paket yang dipilih
          // saat register + naikkan peran jadi seller (server action).
          // Paket dibaca sekali lalu dihapus supaya tidak terpakai ulang.
          const plan = readStoredPlan()
          clearStoredPlan()
          const sub = await ensureStoreSubscription(data.id, plan)
          if (sub.error) {
            setSectionError({
              section,
              message: `Toko tersimpan, tapi langganan gagal dibuat: ${sub.error} — buka halaman Langganan untuk mengulang.`,
            })
            return
          }
          // P1-01: trial kedua diturunkan jadi Free oleh server action —
          // beri tahu pemilik (toko tetap tersimpan; bukan error simpan).
          if (sub.trialAlreadyUsed) {
            setSectionError({
              section,
              message: TRIAL_ALREADY_USED_MESSAGE,
            })
          }
        }
      }

      if (saveError) {
        // Jangan pernah mengklaim sukses saat database menolak.
        setSectionError({
          section,
          message:
            saveError.code === '23505'
              ? 'Slug toko sudah dipakai toko lain. Gunakan slug yang berbeda.'
              : `Gagal menyimpan: ${saveError.message}`,
        })
        return
      }

      setSavedSection(section)
      router.refresh()
    } catch {
      // P1-05: supabase/action melempar — tombol tidak boleh nyangkut "Menyimpan...".
      setSectionError({
        section,
        message: 'Gagal menyimpan. Periksa koneksi lalu coba lagi.',
      })
    } finally {
      setSavingSection(null)
    }
  }

  function saveProfil() {
    const normalizedSlug = normalizeStoreSlug(slug)
    const slugError = validateStoreSlug(normalizedSlug)
    if (slugError) {
      setSectionError({ section: 'profil', message: slugError })
      return
    }
    setSlug(normalizedSlug)
    void saveSection('profil', {
      name,
      slug: normalizedSlug,
      description,
    })
  }

  function saveKontak() {
    // P2-27: username Instagram hanya boleh huruf, angka, titik, dan
    // garis bawah (maks. 30 karakter) — nilai seperti 'foo/bar?x=1'
    // menghasilkan tautan rusak di halaman toko
    // (https://instagram.com/<username>). Kosong = tidak diisi.
    const cleanedInstagram = instagram.trim().replace(/^@/, '')
    if (
      cleanedInstagram &&
      !/^[A-Za-z0-9._]{1,30}$/.test(cleanedInstagram)
    ) {
      setSectionError({
        section: 'kontak',
        message:
          'Username Instagram hanya boleh huruf, angka, titik, dan garis bawah (maksimal 30 karakter, tanpa @, /, spasi, atau ?).',
      })
      return
    }
    void saveSection('kontak', {
      whatsapp,
      city: city.trim() || null,
      address: address.trim() || null,
      instagram: cleanedInstagram || null,
    })
  }

  function saveTampilan() {
    void saveSection('tampilan', {
      theme,
      logo_url: logoUrl,
      banner_url: bannerUrl,
    })
  }

  // K-05 — simpan bagian Pembayaran lewat server action (bukan tulis
  // langsung seperti bagian lain): validasi server-side + tulis
  // rekening ada di sana. Diblokir sampai prefill berhasil dimuat.
  async function savePembayaran() {
    if (!paymentReady) {
      setSectionError({
        section: 'pembayaran',
        message: 'Data pembayaran belum termuat. Muat ulang halaman lalu coba lagi.',
      })
      return
    }
    setSavingSection('pembayaran')
    setSavedSection(null)
    setSectionError(null)
    try {
      const result = await saveStorePaymentAction({
        bankName,
        bankAccountName,
        bankAccountNumber,
        qrisImageUrl,
        codEnabled,
      })
      if ('error' in result) {
        setSectionError({ section: 'pembayaran', message: result.error })
        return
      }
      setSavedSection('pembayaran')
      router.refresh()
    } catch {
      // P1-05: action melempar — tombol tidak boleh nyangkut "Menyimpan...".
      setSectionError({
        section: 'pembayaran',
        message: 'Gagal menyimpan pembayaran. Periksa koneksi lalu coba lagi.',
      })
    } finally {
      setSavingSection(null)
    }
  }

  if (loading)
    return <div className="p-4 text-sm text-[var(--text-muted)]">Memuat...</div>

  if (denied) return <StaffDeniedCard title="Pengaturan Toko" />

  const showOnboardingBanner =
    onboardingStep !== null && onboardingStep > 0 && onboardingStep < 5

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <p className="text-sm font-medium text-[var(--text-muted)]">Toko</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">
          Pengaturan Toko
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          {storeId
            ? 'Setiap bagian disimpan sendiri — ubah yang perlu saja, tidak perlu menyimpan ulang semuanya.'
            : 'Tokomu belum dibuat. Isi bagian Profil lalu simpan untuk membuat tokomu; bagian lain bisa menyusul.'}
        </p>
      </div>

      {showOnboardingBanner ? (
        <section className="rounded-[32px] border border-amber-200 bg-amber-50 p-5 shadow-[var(--shadow-sm)]">
          <p className="text-sm font-bold text-amber-900">
            Setup tokomu belum selesai
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-800">
            Lanjutkan wizard setup supaya tokomu siap dibagikan.
          </p>
          <Link
            href="/dashboard/onboarding"
            className="mt-3 inline-flex items-center justify-center rounded-2xl bg-amber-700 px-4 py-3 text-sm font-semibold text-white"
          >
            Lanjutkan setup
          </Link>
        </section>
      ) : null}

      <SectionCard
        title="Profil toko"
        description="Nama, alamat web (slug), dan cerita singkat tokomu."
        onSave={saveProfil}
        saving={savingSection === 'profil'}
        saved={savedSection === 'profil'}
        error={sectionError?.section === 'profil' ? sectionError.message : ''}
      >
        <Field label="Nama Toko">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputClassName}
            placeholder="Kopi Sore"
          />
        </Field>

        <Field label="Slug Toko" hint={`URL toko: /${normalizeStoreSlug(slug) || 'slug-toko'}`}>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            className={inputClassName}
            placeholder="kopi-sore"
          />
        </Field>

        <Field label="Deskripsi">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={inputClassName}
            placeholder="Ceritakan tentang toko kamu"
          />
        </Field>
      </SectionCard>

      <SectionCard
        title="Kontak & lokasi"
        description="Cara customer menghubungimu dan asal pengiriman toko."
        onSave={saveKontak}
        saving={savingSection === 'kontak'}
        saved={savedSection === 'kontak'}
        error={sectionError?.section === 'kontak' ? sectionError.message : ''}
      >
        <Field label="Nomor WhatsApp" hint="Dipakai tombol Chat di halaman toko dan invoice pembeli.">
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className={inputClassName}
            placeholder="08123456789"
          />
        </Field>

        <Field label="Kota" hint="Tampil di header halaman toko.">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={inputClassName}
            placeholder="Jakarta Selatan"
          />
        </Field>

        <Field label="Alamat">
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            className={inputClassName}
            placeholder="Jl. Contoh No. 1, Kel. ..., Kec. ..."
          />
        </Field>

        <Field label="Instagram" hint="Tampil sebagai tautan di header halaman toko.">
          <input
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            className={inputClassName}
            placeholder="tokokamu (tanpa @)"
          />
        </Field>
      </SectionCard>

      <SectionCard
        title="Tampilan"
        description="Tema warna, logo, dan banner halaman tokomu."
        onSave={saveTampilan}
        saving={savingSection === 'tampilan'}
        saved={savedSection === 'tampilan'}
        error={sectionError?.section === 'tampilan' ? sectionError.message : ''}
      >
        <Field label="Tema">
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className={inputClassName}
          >
            <option value="default">Default (Indigo)</option>
            <option value="warm">Warm (Amber)</option>
            <option value="minimal">Minimal (Slate)</option>
          </select>
        </Field>

        <Field label="Logo">
          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              e.target.files && handleUpload(e.target.files[0], 'logo')
            }
            className="w-full text-sm text-[var(--text-muted)]"
          />
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="logo"
              className="mt-2 h-12 rounded-lg object-cover"
            />
          ) : null}
        </Field>

        <Field label="Banner">
          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              e.target.files && handleUpload(e.target.files[0], 'banner')
            }
            className="w-full text-sm text-[var(--text-muted)]"
          />
          {bannerUrl ? (
            <img
              src={bannerUrl}
              alt="banner"
              className="mt-2 h-24 w-full rounded-xl object-cover"
            />
          ) : null}
        </Field>
      </SectionCard>

      {/* K-05 — bagian Pembayaran: rekening + QRIS + COD, sama seperti
          langkah 2 wizard onboarding. Hanya tampil bila toko sudah ada
          (server action butuh toko milik pemilik); toko baru dibuat dulu
          lewat bagian Profil di atas. */}
      {storeId ? (
        <SectionCard
          title="Pembayaran"
          description="Rekening bank, QRIS, dan COD — tujuan pembayaran yang tampil di halaman invoice pembeli. Isi salah satu: rekening bank untuk transfer, URL gambar QRIS, atau aktifkan COD."
          onSave={savePembayaran}
          saving={savingSection === 'pembayaran'}
          saved={savedSection === 'pembayaran'}
          error={
            sectionError?.section === 'pembayaran' ? sectionError.message : ''
          }
        >
          {paymentError ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Data pembayaran tidak bisa dimuat: {paymentError} Periksa lagi
              nanti — simpan dinonaktifkan sampai data termuat.
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama bank">
              <input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className={inputClassName}
                placeholder="BCA / BRI / GoPay"
              />
            </Field>
            <Field label="Nama pemilik rekening">
              <input
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                className={inputClassName}
                placeholder="Nama di rekening"
              />
            </Field>
          </div>
          <Field
            label="Nomor rekening"
            hint="Hanya angka, spasi, dan tanda hubung. Ketiga kolom rekening harus diisi bersamaan atau dikosongkan bersamaan."
          >
            <input
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              className={inputClassName}
              inputMode="numeric"
              placeholder="1234567890"
            />
          </Field>
          <Field
            label="URL gambar QRIS (opsional)"
            hint="Gambar QRIS statis tokomu — tampil di invoice bila pembeli memilih QRIS manual."
          >
            <input
              value={qrisImageUrl}
              onChange={(e) => setQrisImageUrl(e.target.value)}
              className={inputClassName}
              inputMode="url"
              placeholder="https://.../qris.jpg"
            />
          </Field>
          {qrisImageUrl ? (
            <img
              src={qrisImageUrl}
              alt="QRIS toko"
              className="h-32 rounded-xl border border-[var(--line)] object-contain"
            />
          ) : null}
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--text)]">
            <input
              type="checkbox"
              checked={codEnabled}
              onChange={(e) => setCodEnabled(e.target.checked)}
            />
            Terima COD (bayar di tempat)
          </label>
        </SectionCard>
      ) : null}

      {/* Fase 3: kredensial ShopeePay Partner per toko (QRIS dinamis). */}
      <ShopeePaySettingsForm />
    </div>
  )
}
