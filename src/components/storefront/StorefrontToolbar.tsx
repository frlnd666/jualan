// Toolbar storefront (ala desain referensi): baris pencarian + tombol
// bagikan toko, lalu chip kategori yang bisa digulir horizontal.
// Pencarian dan kategori memakai query URL (?q=, ?kategori=) supaya
// hasilnya bisa dibagikan dan tombol kembali browser tetap bekerja.
// TIDAK ada wishlist dan TIDAK ada "Sort By" — keduanya diganti share.
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import ShareButton from '@/components/storefront/ShareButton'
import { storeShareText } from '@/lib/share'

export type ToolbarCategory = {
  id: string
  name: string
}

type StorefrontToolbarProps = {
  categories: ToolbarCategory[]
  activeCategoryId: string | null
  initialQuery: string
  storeName: string
  storeDescription: string | null
  /** Path toko, mis. "/kopisore" (platform) atau "/" (domain toko). */
  storePath: string
}

function buildHref(
  pathname: string,
  current: URLSearchParams,
  patch: Record<string, string | null>
): string {
  const next = new URLSearchParams(current)
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === '') next.delete(key)
    else next.set(key, value)
  }
  const qs = next.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

export default function StorefrontToolbar({
  categories,
  activeCategoryId,
  initialQuery,
  storeName,
  storeDescription,
  storePath,
}: StorefrontToolbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery)
  const debounceRef = useRef<number | null>(null)

  // Bila pengguna kembali (back/forward) ke URL dengan q berbeda,
  // samakan isi input dengan URL. Penyesuaian saat render (bukan di
  // effect) — pola resmi React untuk "state dari props", dan tidak
  // melanggar react-hooks/set-state-in-effect.
  const [prevInitialQuery, setPrevInitialQuery] = useState(initialQuery)
  if (initialQuery !== prevInitialQuery) {
    setPrevInitialQuery(initialQuery)
    setQuery(initialQuery)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    }
  }, [])

  function pushQuery(value: string) {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      router.replace(buildHref(pathname, searchParams, { q: value.trim() }), {
        scroll: false,
      })
    }, 400)
  }

  function handleQueryChange(value: string) {
    setQuery(value)
    pushQuery(value)
  }

  function handleClearSearch() {
    setQuery('')
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    router.replace(buildHref(pathname, searchParams, { q: null }), { scroll: false })
  }

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition active:scale-[0.97] ${
      active
        ? 'bg-[var(--primary)] text-white shadow-md'
        : 'bg-[var(--surface)] text-[var(--text)] ring-1 ring-black/5 hover:bg-[var(--surface-soft)]'
    }`

  return (
    <div className="mb-5 space-y-3">
      <div className="flex items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Cari produk</span>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="Cari produk..."
            autoComplete="off"
            className="w-full rounded-full border border-black/5 bg-[var(--surface)] py-3 pl-10 pr-9 text-sm text-[var(--text)] shadow-[0_8px_20px_rgba(33,24,20,0.05)] outline-none placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--primary)]/40"
          />
          {query ? (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label="Hapus pencarian"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)]"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </label>

        <ShareButton
          path={storePath}
          title={storeName}
          text={storeShareText(storeName, storeDescription)}
          label="Bagikan"
          className="shrink-0 px-3.5 py-3"
        />
      </div>

      {categories.length > 0 ? (
        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
          role="list"
          aria-label="Kategori produk"
        >
          <Link
            href={buildHref(pathname, searchParams, { kategori: null })}
            className={chipClass(activeCategoryId === null)}
            aria-current={activeCategoryId === null ? 'true' : undefined}
          >
            Semua
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={buildHref(pathname, searchParams, { kategori: category.id })}
              className={chipClass(activeCategoryId === category.id)}
              aria-current={activeCategoryId === category.id ? 'true' : undefined}
            >
              {category.name}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
