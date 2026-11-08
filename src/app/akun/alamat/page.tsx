// Buku alamat pembeli (Fase 2, client): tambah / ubah / hapus /
// jadikan utama. Alamat utama otomatis dipakai saat checkout.
'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  addBuyerAddressAction,
  deleteBuyerAddressAction,
  listBuyerAddressesAction,
  setDefaultAddressAction,
  updateBuyerAddressAction,
  type BuyerAddress,
} from '@/lib/actions/buyer-addresses'

const inputClass =
  'w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none focus:border-neutral-900'
const labelClass = 'mb-1 block text-sm font-medium text-neutral-700'

type FormState = {
  label: string
  recipientName: string
  phone: string
  address: string
  province: string
  city: string
  postalCode: string
  isDefault: boolean
}

const emptyForm: FormState = {
  label: 'Rumah',
  recipientName: '',
  phone: '',
  address: '',
  province: '',
  city: '',
  postalCode: '',
  isDefault: false,
}

export default function BuyerAddressesPage() {
  const [addresses, setAddresses] = useState<BuyerAddress[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isPending, startTransition] = useTransition()

  async function refresh() {
    setAddresses(await listBuyerAddressesAction())
    setLoaded(true)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const data = await listBuyerAddressesAction()
      if (cancelled) return
      setAddresses(data)
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setShowForm(true)
  }

  function openEdit(address: BuyerAddress) {
    setEditingId(address.id)
    setForm({
      label: address.label,
      recipientName: address.recipient_name,
      phone: address.phone,
      address: address.address,
      province: address.province,
      city: address.city,
      postalCode: address.postal_code,
      isDefault: address.is_default,
    })
    setError('')
    setShowForm(true)
  }

  function save() {
    setError('')
    setNotice('')
    startTransition(async () => {
      const result = editingId
        ? await updateBuyerAddressAction(editingId, form)
        : await addBuyerAddressAction(form)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setNotice(editingId ? 'Alamat diperbarui.' : 'Alamat ditambahkan.')
      setShowForm(false)
      await refresh()
    })
  }

  function remove(id: string) {
    if (!window.confirm('Hapus alamat ini?')) return
    startTransition(async () => {
      await deleteBuyerAddressAction(id)
      await refresh()
    })
  }

  function makeDefault(id: string) {
    startTransition(async () => {
      await setDefaultAddressAction(id)
      await refresh()
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--text-muted)]">Akun Saya</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">
            Alamat Saya
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Alamat utama otomatis terisi saat checkout.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="shrink-0 rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-sm)]"
        >
          + Tambah alamat
        </button>
      </div>

      {notice ? (
        <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </p>
      ) : null}

      {showForm ? (
        <section className="space-y-4 rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
          <h2 className="text-base font-bold text-[var(--text)]">
            {editingId ? 'Ubah alamat' : 'Alamat baru'}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Label (mis. Rumah / Kantor)</label>
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className={inputClass}
                placeholder="Rumah"
              />
            </div>
            <div>
              <label className={labelClass}>Nama penerima</label>
              <input
                value={form.recipientName}
                onChange={(e) =>
                  setForm({ ...form, recipientName: e.target.value })
                }
                className={inputClass}
                placeholder="Nama lengkap"
              />
            </div>
            <div>
              <label className={labelClass}>No. HP</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputClass}
                inputMode="tel"
                placeholder="0812..."
              />
            </div>
            <div>
              <label className={labelClass}>Kode pos</label>
              <input
                value={form.postalCode}
                onChange={(e) =>
                  setForm({ ...form, postalCode: e.target.value })
                }
                className={inputClass}
                inputMode="numeric"
                placeholder="42100"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Alamat lengkap</label>
              <textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={2}
                className={inputClass}
                placeholder="Jalan, nomor rumah, RT/RW, kelurahan"
              />
            </div>
            <div>
              <label className={labelClass}>Provinsi</label>
              <input
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
                className={inputClass}
                placeholder="Banten"
              />
            </div>
            <div>
              <label className={labelClass}>Kota/Kabupaten</label>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className={inputClass}
                placeholder="Kota Serang"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            />
            Jadikan alamat utama
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isPending ? 'Menyimpan...' : 'Simpan alamat'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text)]"
            >
              Batal
            </button>
          </div>
        </section>
      ) : null}

      {!loaded ? (
        <p className="text-sm text-[var(--text-muted)]">Memuat alamat...</p>
      ) : addresses.length === 0 ? (
        <section className="rounded-[32px] border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-sm)]">
          <p className="text-base font-bold text-[var(--text)]">
            Belum ada alamat tersimpan
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Tambahkan alamat supaya checkout lebih cepat.
          </p>
        </section>
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => (
            <article
              key={address.id}
              className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--text)]">
                    {address.label}{' '}
                    {address.is_default ? (
                      <span className="ml-1 rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--primary)]">
                        Utama
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text)]">
                    {address.recipient_name} • {address.phone}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                    {address.address}, {address.city}, {address.province}{' '}
                    {address.postal_code}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                {!address.is_default ? (
                  <button
                    type="button"
                    onClick={() => makeDefault(address.id)}
                    disabled={isPending}
                    className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-[var(--text)]"
                  >
                    Jadikan utama
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => openEdit(address)}
                  className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-[var(--text)]"
                >
                  Ubah
                </button>
                <button
                  type="button"
                  onClick={() => remove(address.id)}
                  disabled={isPending}
                  className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-red-700"
                >
                  Hapus
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
