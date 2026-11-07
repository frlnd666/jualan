'use client'

import { useState } from 'react'

type InvoiceShareButtonsProps = {
  /** Path invoice termasuk token, mis. /invoice/INV-...?t=... */
  invoicePath: string
  invoiceNumber: string
  storeName: string
  /** Nomor WhatsApp toko (format bebas, dinormalisasi di sini). */
  storeWhatsapp?: string | null
}

function normalizeWaNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('62')) return digits
  return digits
}

/**
 * Tombol "simpan halaman ini": salin link invoice + kirim ke WhatsApp.
 * Link invoice (dengan tokennya) adalah satu-satunya kunci pesanan pembeli
 * tanpa akun, jadi harus semudah mungkin disimpan.
 */
export default function InvoiceShareButtons({
  invoicePath,
  invoiceNumber,
  storeName,
  storeWhatsapp,
}: InvoiceShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  function absoluteUrl(): string {
    if (typeof window === 'undefined') return invoicePath
    return `${window.location.origin}${invoicePath}`
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(absoluteUrl())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  const shareText = encodeURIComponent(
    `Invoice ${invoiceNumber} dari ${storeName}: ${absoluteUrl()}`
  )
  const waShareHref = `https://wa.me/?text=${shareText}`

  const sellerNumber = storeWhatsapp ? normalizeWaNumber(storeWhatsapp) : ''
  const sellerText = encodeURIComponent(
    `Halo ${storeName}, saya mau konfirmasi pembayaran untuk invoice ${invoiceNumber}.`
  )
  const waSellerHref = sellerNumber
    ? `https://wa.me/${sellerNumber}?text=${sellerText}`
    : null

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={handleCopy}
        className="flex-1 rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
      >
        {copied ? 'Link tersalin ✓' : 'Salin link halaman ini'}
      </button>
      <a
        href={waShareHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 rounded-2xl bg-emerald-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        Kirim ke WhatsApp
      </a>
      {waSellerHref ? (
        <a
          href={waSellerHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-center text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
        >
          Chat penjual
        </a>
      ) : null}
    </div>
  )
}
