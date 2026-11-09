'use client'

import { useState } from 'react'

/** Tombol salin kecil untuk teks pendek (mis. nomor resi). */
export default function CopyTextButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      // Fallback untuk browser/konteks tanpa akses Clipboard API
      // (mis. halaman non-HTTPS): salin lewat textarea sementara.
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setCopied(true)
      } catch {
        setCopied(false)
        return
      }
    }
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
    >
      {copied ? 'Tersalin ✓' : 'Salin'}
    </button>
  )
}
