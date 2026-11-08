// Form buat banner marketing toko (client) — owner Silver/Gold.
// Teks wajib; gambar + tautan opsional. Maks 1 slide aktif per toko.
'use client'

import { useState, useTransition } from 'react'
import { createStoreBannerAction } from '@/lib/actions/store-banners'

export default function BannerForm({ disabled }: { disabled: boolean }) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      const result = await createStoreBannerAction(formData)
      if (result.error) {
        setMessage(result.error)
        return
      }
      setMessage(result.success ?? 'Banner dibuat.')
    })
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-3 rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]"
    >
      <h2 className="text-base font-bold text-[var(--text)]">Buat banner</h2>
      <div>
        <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]" htmlFor="banner-title">
          Teks banner
        </label>
        <input
          id="banner-title"
          name="title"
          type="text"
          maxLength={120}
          required
          disabled={disabled}
          placeholder="mis. Promo Akhir Pekan — Diskon 20% Semua Menu"
          className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]" htmlFor="banner-image">
          URL gambar (opsional)
        </label>
        <input
          id="banner-image"
          name="imageUrl"
          type="url"
          disabled={disabled}
          placeholder="https://…"
          className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]" htmlFor="banner-link">
          Tautan saat diklik (opsional)
        </label>
        <input
          id="banner-link"
          name="linkUrl"
          type="text"
          disabled={disabled}
          placeholder="https://… atau /nama-toko"
          className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
        />
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
        {isPending ? 'Menyimpan…' : 'Buat banner'}
      </button>
    </form>
  )
}
