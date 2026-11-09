// Form kredensial ShopeePay Partner di Pengaturan toko (Fase 3).
// Client Component — memanggil server action owner-only. Secret dan
// private key TIDAK PERNAH ditampilkan kembali setelah tersimpan
// (hanya status "terisi" + merchant ID tersamar). Tanpa kredensial
// aktif, checkout QRIS tetap jalan lewat alur manual lama.
'use client'

import { useEffect, useState } from 'react'
import {
  deleteShopeePayCredentialsAction,
  getShopeePayStatusAction,
  saveShopeePayCredentialsAction,
  setShopeePayActiveAction,
  type ShopeePayStatus,
} from '@/lib/actions/shopeepay-credentials'

const inputClassName =
  'w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]'

export default function ShopeePaySettingsForm() {
  const [status, setStatus] = useState<ShopeePayStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [merchantId, setMerchantId] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  async function load() {
    setLoading(true)
    try {
      const result = await getShopeePayStatusAction()
      if ('error' in result) {
        setErrorMessage(result.error)
      } else {
        setStatus(result)
      }
    } catch {
      // P1-05: status gagal dimuat — jangan nyangkut "Memuat status ShopeePay...".
      setErrorMessage(
        'Gagal memuat status ShopeePay. Muat ulang halaman lalu coba lagi.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    getShopeePayStatusAction()
      .then((result) => {
        if (cancelled) return
        if ('error' in result) {
          setErrorMessage(result.error)
        } else {
          setStatus(result)
        }
        setLoading(false)
      })
      .catch(() => {
        // P1-05: tanpa .catch(), reject membuat halaman nyangkut "Memuat status ShopeePay...".
        if (cancelled) return
        setErrorMessage(
          'Gagal memuat status ShopeePay. Muat ulang halaman lalu coba lagi.'
        )
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSave() {
    setErrorMessage('')
    setSuccessMessage('')
    setSaving(true)
    try {
      const formData = new FormData()
      formData.set('clientId', clientId)
      formData.set('clientSecret', clientSecret)
      formData.set('privateKey', privateKey)
      formData.set('merchantId', merchantId)
      const result = await saveShopeePayCredentialsAction(formData)
      if (result.error) {
        setErrorMessage(result.error)
        return
      }
      setSuccessMessage(result.success ?? 'Tersimpan.')
      setClientId('')
      setClientSecret('')
      setPrivateKey('')
      setMerchantId('')
      await load()
    } catch {
      // P1-05: action melempar — tombol tidak boleh nyangkut "Menyimpan...".
      setErrorMessage(
        'Gagal menyimpan kredensial. Periksa koneksi lalu coba lagi.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(next: boolean) {
    setErrorMessage('')
    try {
      const result = await setShopeePayActiveAction(next)
      if (result.error) {
        setErrorMessage(result.error)
        return
      }
      setSuccessMessage(result.success ?? '')
      await load()
    } catch {
      // P2-14: action melempar (mis. jaringan putus) — tampilkan pesan,
      // jangan jadi unhandled rejection.
      setErrorMessage('Gagal mengubah status ShopeePay. Periksa koneksi lalu coba lagi.')
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        'Hapus kredensial ShopeePay? QRIS dinamis akan nonaktif dan checkout QRIS kembali ke alur manual.'
      )
    ) {
      return
    }
    setErrorMessage('')
    try {
      const result = await deleteShopeePayCredentialsAction()
      if (result.error) {
        setErrorMessage(result.error)
        return
      }
      setSuccessMessage(result.success ?? '')
      await load()
    } catch {
      // P2-14: action melempar — tampilkan pesan, jangan unhandled rejection.
      setErrorMessage('Gagal menghapus kredensial ShopeePay. Periksa koneksi lalu coba lagi.')
    }
  }

  if (loading) {
    return (
      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
        <p className="text-sm text-[var(--text-muted)]">Memuat status ShopeePay...</p>
      </section>
    )
  }

  return (
    <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
      <h2 className="text-base font-bold text-[var(--text)]">Pembayaran ShopeePay (QRIS dinamis)</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        QRIS dinamis per toko: pembeli memindai satu QR dengan nominal
        terkunci, pembayaran terverifikasi otomatis tanpa upload bukti. Dana
        masuk langsung ke ShopeePay toko ini — platform tidak menampung dana.
      </p>

      {status && !status.encryptionReady ? (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Kunci enkripsi platform (SHOPEEPAY_ENCRYPTION_KEY) belum dipasang di
          server. Minta admin platform mengisinya dulu sebelum menyimpan
          kredensial.
        </p>
      ) : null}

      {status?.configured ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-800">
            Kredensial terisi ✓ — Merchant ID {status.merchantIdMasked}
          </p>
          <p className="text-xs leading-5 text-emerald-700">
            Secret dan private key tersimpan terenkripsi dan tidak ditampilkan
            lagi. Isi ulang form di bawah untuk menggantinya.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleToggle(!status.isActive)}
              className="rounded-2xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800"
            >
              {status.isActive ? 'Matikan QRIS dinamis' : 'Aktifkan QRIS dinamis'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Hapus kredensial
            </button>
          </div>
          <p className="text-xs text-emerald-700">
            Status: {status.isActive ? 'aktif — checkout QRIS memakai QR dinamis' : 'nonaktif — checkout QRIS memakai alur manual'}.
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          Belum ada kredensial — checkout QRIS masih memakai alur manual
          (penjual memberi QR, pembeli upload bukti). Daftarkan toko ini ke
          ShopeePay Partner untuk mengaktifkan QR dinamis; kredensial sandbox
          dipakai dulu untuk pengujian.
        </p>
      )}

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[var(--text)]">Client ID</span>
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className={inputClassName}
            placeholder="Client ID dari ShopeePay Partner"
            autoComplete="off"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[var(--text)]">Client Secret</span>
          <input
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            type="password"
            className={inputClassName}
            placeholder="Client Secret"
            autoComplete="off"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[var(--text)]">Private Key (PEM)</span>
          <textarea
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            rows={4}
            className={inputClassName}
            placeholder="-----BEGIN PRIVATE KEY-----"
            autoComplete="off"
          />
          <span className="mt-2 block text-xs text-[var(--text-muted)]">
            Salin persis dari file .pem ShopeePay, termasuk baris BEGIN/END.
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[var(--text)]">Merchant ID</span>
          <input
            value={merchantId}
            onChange={(e) => setMerchantId(e.target.value)}
            className={inputClassName}
            placeholder="Merchant ID toko ini"
            autoComplete="off"
          />
        </label>
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {successMessage}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || (status !== null && !status.encryptionReady)}
        className="mt-5 w-full rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {saving ? 'Menyimpan...' : 'Simpan kredensial ShopeePay'}
      </button>
    </section>
  )
}
