// Form buat flash sale (client) — owner Silver/Gold.
// Harga promo + jadwal mulai/selesai; produk dipilih dari daftar.
'use client'

import { useState, useTransition } from 'react'
import { createFlashSaleAction } from '@/lib/actions/flash-sales'
import { isoToLocalInput, localInputToIso } from '@/lib/datetime'

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
    // datetime-local tidak membawa zona waktu — konversi ke ISO di
    // browser penjual SEBELUM dikirim, kalau tidak server (UTC)
    // membacanya sebagai UTC dan jadwal bergeser +7 jam (lihat
    // src/lib/datetime.ts).
    for (const key of ['startsAt', 'endsAt'] as const) {
      const value = String(formData.get(key) ?? '')
      if (value) formData.set(key, localInputToIso(value))
    }
    startTransition(async () => {
      try {
        const result = await createFlashSaleAction(formData)
        if (result.error) {
          setMessage(result.error)
          return
        }
        setMessage(result.success ?? 'Flash sale dibuat.')
      } catch {
        // P2-13: action melempar (mis. jaringan putus) — jangan biarkan
        // error naik ke error boundary; tampilkan inline.
        setMessage('Gagal membuat flash sale. Periksa koneksi lalu coba lagi.')
      }
    })
  }

  const now = new Date()
  const defaultStart = isoToLocalInput(new Date(now.getTime() + 60 * 60 * 1000).toISOString())
  const defaultEnd = isoToLocalInput(new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString())

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
