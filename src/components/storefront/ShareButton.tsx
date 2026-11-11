// Tombol bagikan (share) — pengganti wishlist di kartu produk.
// Pakai Web Share API bila tersedia (sheet bawaan HP), kalau tidak
// salin tautan ke clipboard dan tampilkan "Disalin". URL dibangun dari
// origin halaman yang sedang dibuka + path relatif, jadi benar di
// domain platform, subdomain, maupun domain custom toko.
'use client'

import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { buildShareUrl } from '@/lib/share'

type ShareButtonProps = {
  /** Path relatif yang dibagikan, mis. "/kopisore/produk/kopi-kita". */
  path: string
  title: string
  text: string
  label?: string
  className?: string
}

export default function ShareButton({
  path,
  title,
  text,
  label = 'Bagikan',
  className = '',
}: ShareButtonProps) {
  const [state, setState] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle')

  async function handleShare() {
    const url = buildShareUrl(window.location.origin, path)
    // Web Share API (Android/iOS): sheet bawaan sistem.
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title, text, url })
        setState('shared')
        window.setTimeout(() => setState('idle'), 1500)
        return
      } catch (error) {
        // Dibatalkan pengguna = bukan error; jangan jatuh ke clipboard.
        if (error instanceof Error && error.name === 'AbortError') return
        // Gagal lain (mis. data tidak didukung) → lanjut ke clipboard.
      }
    }
    // Fallback: salin tautan.
    try {
      await navigator.clipboard.writeText(url)
      setState('copied')
      window.setTimeout(() => setState('idle'), 1500)
    } catch {
      setState('failed')
      window.setTimeout(() => setState('idle'), 1500)
    }
  }

  const done = state === 'shared' || state === 'copied'
  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full bg-white/95 text-[var(--text)] shadow-sm ring-1 ring-black/5 transition active:scale-95 ${
        done ? 'text-[var(--primary)]' : ''
      } ${className}`}
    >
      {done ? (
        <Check className="h-4 w-4" aria-hidden />
      ) : (
        <Share2 className="h-4 w-4" aria-hidden />
      )}
      <span className="text-[11px] font-semibold">
        {state === 'copied'
          ? 'Disalin'
          : state === 'shared'
            ? 'Dibagikan'
            : state === 'failed'
              ? 'Gagal menyalin'
              : label}
      </span>
    </button>
  )
}
