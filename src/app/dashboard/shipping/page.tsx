'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ShippingMethodRow = {
  id: string
  store_id: string
  name: string
  price: number | string
  estimated_days: string | null
  is_active: boolean
  created_at: string
}

function formatRupiah(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0)
  if (Number.isNaN(numeric)) return '0'
  return numeric.toLocaleString('id-ID')
}

function sanitizeNumberInput(value: string) {
  return value.replace(/D/g, '')
}

function parseNumberInput(value: string) {
  return Number(value || 0)
}

function formatRupiahPreview(value: string) {
  if (!value) return '0'
  return Number(value).toLocaleString('id-ID')
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(date)
}

export default function ShippingPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [storeId, setStoreId] = useState('')
  const [methods, setMethods] = useState<ShippingMethodRow[]>([])

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [estimatedDays, setEstimatedDays] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [editingId, setEditingId] = useState<string | null>(null)

  const [loadingPage, setLoadingPage] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  async function loadShippingMethods(currentStoreId?: string) {
    const activeStoreId = currentStoreId || storeId

    if (!activeStoreId) return

    const { data, error } = await supabase
      .from('shipping_methods')
      .select('id, store_id, name, price, estimated_days, is_active, created_at')
      .eq('store_id', activeStoreId)
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage('Gagal memuat metode pengiriman.')
      return
    }

    setMethods((data || []) as ShippingMethodRow[])
  }

  useEffect(() => {
    async function initialize() {
      setLoadingPage(true)
      setErrorMessage('')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (storeError || !store) {
        setErrorMessage('Toko tidak ditemukan untuk akun ini.')
        setLoadingPage(false)
        return
      }

      setStoreId(store.id)
      await loadShippingMethods(store.id)
      setLoadingPage(false)
    }

    initialize()
  }, [supabase, router])

  function resetForm() {
    setName('')
    setPrice('')
    setEstimatedDays('')
    setIsActive(true)
    setEditingId(null)
  }

  function startEdit(method: ShippingMethodRow) {
    setEditingId(method.id)
    setName(method.name)
    setPrice(String(method.price ?? ''))
    setEstimatedDays(method.estimated_days || '')
    setIsActive(method.is_active)
    setErrorMessage('')
    setSuccessMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit() {
    setErrorMessage('')
    setSuccessMessage('')

    if (!storeId) {
      setErrorMessage('Store tidak ditemukan.')
      return
    }

    if (!name.trim()) {
      setErrorMessage('Nama ekspedisi atau metode pengiriman wajib diisi.')
      return
    }

    if (parseNumberInput(price) < 0) {
      setErrorMessage('Harga ongkir tidak valid.')
      return
    }

    try {
      setSaving(true)

      const payload = {
        store_id: storeId,
        name: name.trim(),
        price: parseNumberInput(price),
        estimated_days: estimatedDays.trim() || null,
        is_active: isActive,
      }

      if (editingId) {
        const { error } = await supabase
          .from('shipping_methods')
          .update(payload)
          .eq('id', editingId)
          .eq('store_id', storeId)

        if (error) throw error

        setSuccessMessage('Metode pengiriman berhasil diperbarui.')
      } else {
        const { error } = await supabase.from('shipping_methods').insert(payload)

        if (error) throw error

        setSuccessMessage('Metode pengiriman berhasil ditambahkan.')
      }

      resetForm()
      await loadShippingMethods()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal menyimpan metode pengiriman.'
      setErrorMessage(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(method: ShippingMethodRow) {
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const { error } = await supabase
        .from('shipping_methods')
        .update({ is_active: !method.is_active })
        .eq('id', method.id)
        .eq('store_id', storeId)

      if (error) throw error

      setSuccessMessage(
        !method.is_active
          ? 'Metode pengiriman berhasil diaktifkan.'
          : 'Metode pengiriman berhasil dinonaktifkan.',
      )

      await loadShippingMethods()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal mengubah status metode pengiriman.'
      setErrorMessage(message)
    }
  }

  async function handleDelete(methodId: string) {
    const confirmed = window.confirm(
      'Hapus metode pengiriman ini? Tindakan ini tidak bisa dibatalkan.',
    )

    if (!confirmed) return

    setErrorMessage('')
    setSuccessMessage('')

    try {
      const { error } = await supabase
        .from('shipping_methods')
        .delete()
        .eq('id', methodId)
        .eq('store_id', storeId)

      if (error) throw error

      if (editingId === methodId) {
        resetForm()
      }

      setSuccessMessage('Metode pengiriman berhasil dihapus.')
      await loadShippingMethods()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal menghapus metode pengiriman.'
      setErrorMessage(message)
    }
  }

  const totalMethods = methods.length
  const activeMethods = methods.filter((method) => method.is_active).length
  const inactiveMethods = methods.filter((method) => !method.is_active).length

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--text-muted)]">
            Pengiriman toko
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">
            Metode Ekspedisi
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Atur metode pengiriman yang akan muncul saat customer checkout.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/products"
            className="inline-flex items-center justify-center rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-soft)]"
          >
            Kembali ke produk
          </Link>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Total metode
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--text)]">
            {totalMethods}
          </p>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Aktif
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {activeMethods}
          </p>
        </div>

        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Nonaktif
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {inactiveMethods}
          </p>
        </div>
      </section>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--text)]">
              {editingId ? 'Edit metode pengiriman' : 'Tambah metode pengiriman'}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Contoh: Ambil di toko, Kurir toko, JNE Reguler, J&T, SiCepat.
            </p>
          </div>

          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center justify-center rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--text)]"
            >
              Batal edit
            </button>
          ) : null}
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--text)]">
              Nama metode
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
              placeholder="Contoh: JNE Reguler"
              disabled={loadingPage || saving}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--text)]">
                Ongkir
              </span>

              <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 focus-within:border-[var(--primary)]">
                <div className="flex items-center">
                  <span className="mr-3 text-sm font-semibold text-[var(--text-muted)]">
                    Rp
                  </span>
                  <input
                    value={price}
                    onChange={(e) => setPrice(sanitizeNumberInput(e.target.value))}
                    className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
                    placeholder="10000"
                    inputMode="numeric"
                    disabled={loadingPage || saving}
                  />
                </div>

                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Preview: Rp {formatRupiahPreview(price)}
                </p>
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--text)]">
                Estimasi
              </span>
              <input
                value={estimatedDays}
                onChange={(e) => setEstimatedDays(e.target.value)}
                className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
                placeholder="1-2 hari"
                disabled={loadingPage || saving}
              />
            </label>
          </div>

          <label className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">
                Aktifkan metode ini
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Jika aktif, metode ini akan tampil saat checkout customer.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsActive((prev) => !prev)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                isActive ? 'bg-[var(--primary)]' : 'bg-gray-300'
              }`}
              disabled={loadingPage || saving}
              aria-label={isActive ? 'Nonaktifkan metode' : 'Aktifkan metode'}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </label>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loadingPage || saving}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingPage
              ? 'Memuat...'
              : saving
              ? editingId
                ? 'Menyimpan perubahan...'
                : 'Menambahkan metode...'
              : editingId
              ? 'Simpan perubahan'
              : 'Tambah metode'}
          </button>
        </div>
      </section>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--text)]">
              Daftar metode
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Kelola metode aktif yang muncul di checkout customer.
            </p>
          </div>
        </div>

        {loadingPage ? (
          <div className="mt-4 rounded-2xl bg-[var(--surface-soft)] px-4 py-4 text-sm text-[var(--text-muted)]">
            Memuat metode pengiriman...
          </div>
        ) : methods.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-soft)] px-4 py-5 text-sm text-[var(--text-muted)]">
            Belum ada metode pengiriman. Tambahkan metode pertama agar customer
            bisa memilih pengiriman saat checkout.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {methods.map((method) => (
              <div
                key={method.id}
                className="rounded-[28px] border border-[var(--line)] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-[var(--text)]">
                      {method.name}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                      Rp {formatRupiah(method.price)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Estimasi: {method.estimated_days || '-'}
                    </p>
                  </div>

                  <span
                    className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
                      method.is_active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-gray-100 text-gray-600'
                    }`}
                  >
                    {method.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Dibuat
                    </p>
                    <p className="mt-1 text-sm font-bold text-[var(--text)]">
                      {formatDate(method.created_at)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Status checkout
                    </p>
                    <p className="mt-1 text-sm font-bold text-[var(--text)]">
                      {method.is_active ? 'Tampil ke customer' : 'Disembunyikan'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(method)}
                    className="inline-flex items-center justify-center rounded-2xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-soft)]"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleActive(method)}
                    className="inline-flex items-center justify-center rounded-2xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-soft)]"
                  >
                    {method.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(method.id)}
                    className="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}