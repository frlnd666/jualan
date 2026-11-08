// Form buat flash sale (client) — owner Silver/Gold.
// Harga promo + jadwal mulai/selesai; produk dipilih dari daftar.
'use client'

import { useState, useTransition } from 'react'
import { createFlashSaleAction } from '@/lib/actions/flash-sales'

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function FlashSaleForm({
  products,
  disabled,
}: {
  products: Array<{ id: string; name: string; price: number }>
  disabled: boolean
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      const result = await createFlashSaleAction(formData)
      if (result.error) {
        setMessage(result.error)
        return
      }
      setMessage(result.success ?? 'Flash sale dibuat.')
    })
  }

  const now = new Date()
  const defaultStart = toLocalInput(new Date(now.getTime() + 60 * 60 * 1000).toISOString())
  const defaultEnd = toLocalInput(new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString())

  return (
    <form
      action={handleSubmit}
      className="space-y-3 rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]"
    >
      <h2 className="text-base font-bold text-[var(--text)]">Buat flash sale</h2>
      <div>
        <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]" htmlFor="flash-product">
          Produk
        </label>
        <select
          id="flash-product"
          name="productId"
          required
          disabled={disabled}
          className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
        >
          <option value="">Pilih produk…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — Rp {p.price.toLocaleString('id-ID')}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]" htmlFor="flash-price">
          Harga promo (Rp)
        </label>
        <input
          id="flash-price"
          name="promoPrice"
          type="number"
          min={1}
          step={1}
          required
          disabled={disabled}
          placeholder="mis. 15000"
          className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
        />
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Harus lebih murah dari harga normal produk.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]" htmlFor="flash-start">
            Mulai
          </label>
          <input
            id="flash-start"
            name="startsAt"
            type="datetime-local"
            required
            disabled={disabled}
            defaultValue={defaultStart}
            className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]" htmlFor="flash-end">
            Berakhir
          </label>
          <input
            id="flash-end"
            name="endsAt"
            type="datetime-local"
            required
            disabled={disabled}
            defaultValue={defaultEnd}
            className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
          />
        </div>
      </div>
      {message ? (
        <p className="rounded-2xl bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)]">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={disabled || isPending}
        className="w-full rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? 'Menyimpan…' : 'Buat flash sale'}
      </button>
    </form>
  )
}
