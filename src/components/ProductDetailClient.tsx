'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCart } from '@/lib/use-cart'
import { createClient } from '@/lib/supabase/client'
import WatermarkedImage from '@/components/storefront/WatermarkedImage'
import ShareButton from '@/components/storefront/ShareButton'
import { productShareText } from '@/lib/share'
import {
  discountPercent,
  formatFlashRemaining,
  flashSaleRemainingMs,
  type FlashSaleLike,
} from '@/lib/flash-sales'
import { Check, ImageOff } from 'lucide-react'

type Product = {
  id: string
  name: string
  slug: string
  price: number | string
  store_id?: string | null
  description?: string | null
  images?: string[] | null
  badge?: string | null
  stock?: number | null
  available?: boolean | null
  /** Berat per unit (gram, Fase 3) — dipakai hitung ongkir. */
  weight_gram?: number | null
}

type ProductDetailClientProps = {
  storeSlug: string
  product: Product
  /** Flash sale aktif untuk produk ini (Fase 4) — null bila tidak ada. */
  flashSale?: FlashSaleLike | null
  /** Tampilkan watermark platform di foto (paket Free). */
  watermarked?: boolean
  /** Tautan "kembali ke toko" — '/' di domain custom/subdomain, '/{slug}' di platform (Fase 5). */
  homeHref?: string
}

function formatRupiah(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0)
  if (Number.isNaN(numeric)) return '0'
  return numeric.toLocaleString('id-ID')
}

function getStockLabel(stock: number | null | undefined, available: boolean | null | undefined) {
  const safeStock = Number(stock ?? 0)

  if (available === false) {
    return {
      text: 'Sedang tidak tersedia',
      className: 'bg-gray-100 text-gray-600 border-gray-200',
    }
  }

  if (safeStock <= 0) {
    return {
      text: 'Stok habis',
      className: 'bg-rose-50 text-rose-700 border-rose-200',
    }
  }

  if (safeStock <= 5) {
    return {
      text: 'Stok terbatas',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    }
  }

  return {
    text: 'Tersedia',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
}

export default function ProductDetailClient({
  storeSlug,
  product,
  flashSale = null,
  watermarked = false,
  homeHref,
}: ProductDetailClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const backHref = homeHref ?? `/${storeSlug}`
  const images = useMemo(() => {
    return Array.isArray(product.images) ? product.images.filter(Boolean) : []
  }, [product.images])

  // Fase 4 — harga efektif: harga promo bila ada flash sale aktif dan
  // lebih murah dari harga normal. Harga efektif hanya untuk TAMPILAN:
  // yang masuk keranjang adalah harga NORMAL (audit 2026-11-09) —
  // promo diterapkan dinamis oleh lapisan checkout dari data flash
  // sale yang sedang aktif, supaya snapshot promo basi di keranjang
  // tidak membuat total preview lebih murah dari tagihan server.
  const normalPrice = Number(product.price)
  const hasFlash =
    flashSale !== null && Number(flashSale.promo_price) < normalPrice
  const displayPrice = hasFlash ? Number(flashSale.promo_price) : normalPrice

  const [activeImage, setActiveImage] = useState(images[0] || '')
  const stockInfo = getStockLabel(product.stock, product.available)

  const isDisabled =
    product.available === false || Number(product.stock ?? 0) <= 0

  const addItem = useCart((state) => state.addItem)
  const maxQty = Math.max(1, Number(product.stock ?? 1))
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(false)

  // "Pesan sekarang" hanya untuk pembeli login: tamu diarahkan daftar
  // sebagai pembeli dulu, lalu kembali ke halaman produk ini (param
  // next). Keranjang sendiri tetap bisa diisi tamu (localStorage);
  // gate ini hanya di tombol pesan — checkout tamu ditutup di
  // createOrderAction + halaman /checkout.
  async function handleOrderNow() {
    if (isDisabled) return
    setCheckingAuth(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        const currentPath =
          window.location.pathname + window.location.search
        router.push(
          `/register?type=buyer&next=${encodeURIComponent(currentPath)}`
        )
        return
      }
    } catch {
      // Cek sesi gagal (mis. jaringan) — lanjut seperti biasa (tambah
      // ke keranjang); penegakan yang mengikat ada di server checkout.
    } finally {
      setCheckingAuth(false)
    }
    handleAddToCart()
  }

  function handleAddToCart() {
    addItem(
      {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: normalPrice,
        store_id: product.store_id ?? null,
        images: product.images ?? null,
        badge: product.badge ?? null,
        // Fase 3: berat ikut ke keranjang supaya checkout bisa
        // menampilkan ongkir berbasis berat sebelum submit.
        weight_gram: product.weight_gram ?? null,
      },
      storeSlug,
      qty
    )
    setAdded(true)
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-32 text-[var(--text)]">
      <div className="mx-auto max-w-4xl">
        <div className="px-4 pt-4 sm:px-6">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--text)] shadow-[0_8px_20px_rgba(33,24,20,0.05)] transition hover:bg-[var(--surface-soft)]"
          >
            <span aria-hidden="true">←</span>
            Kembali ke toko
          </Link>
        </div>

        <main className="px-4 pb-8 pt-4 sm:px-6">
          <div className="overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-[0_16px_40px_rgba(33,24,20,0.07)]">
            <section className="relative bg-[var(--surface-muted)]">
              <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[16/10]">
                {activeImage ? (
                  <WatermarkedImage
                    src={activeImage}
                    alt={product.name}
                    watermarked={watermarked}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--surface-soft)] px-6 text-center">
                    <ImageOff className="h-12 w-12 text-[var(--text-muted)]" />
                    <p className="mt-4 text-sm font-medium text-[var(--text-muted)]">
                      Foto produk akan segera ditambahkan
                    </p>
                  </div>
                )}
              </div>

              {product.badge ? (
                <div className="absolute left-4 top-4">
                  <span className="rounded-full bg-[var(--primary-deep)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white shadow-lg">
                    {product.badge}
                  </span>
                </div>
              ) : null}
            </section>

            {images.length > 1 ? (
              <section className="border-t border-black/5 bg-[var(--surface)] px-4 py-4 sm:px-6">
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {images.map((image, index) => {
                    const isActive = image === activeImage

                    return (
                      <button
                        key={`${image}-${index}`}
                        type="button"
                        onClick={() => setActiveImage(image)}
                        className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border transition ${
                          isActive
                            ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/15'
                            : 'border-black/5'
                        }`}
                      >
                        <img
                          src={image}
                          alt={`${product.name} ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    )
                  })}
                </div>
              </section>
            ) : null}

            <section className="px-4 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Detail produk
                  </p>
                  <h1 className="mt-2 text-2xl font-bold leading-tight text-[var(--text)]">
                    {product.name}
                  </h1>
                </div>

                <span
                  className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${stockInfo.className}`}
                >
                  {stockInfo.text}
                </span>
              </div>

              <div className="mt-4 flex items-end justify-between gap-4 rounded-[28px] bg-[var(--surface-soft)] px-4 py-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Harga
                  </p>
                  {hasFlash ? (
                    <p className="mt-1 text-sm font-medium text-[var(--text-muted)] line-through">
                      Rp {formatRupiah(normalPrice)}
                    </p>
                  ) : null}
                  <p className="mt-1 text-2xl font-bold text-[var(--primary)]">
                    Rp {formatRupiah(displayPrice)}
                  </p>
                  {hasFlash && flashSale ? (
                    <p className="mt-1 inline-flex rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700">
                      FLASH SALE −{discountPercent(normalPrice, displayPrice)}% •{' '}
                      {formatFlashRemaining(
                        flashSaleRemainingMs(flashSale, new Date())
                      )}
                    </p>
                  ) : null}
                </div>

                <div className="text-right">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Status
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                    {isDisabled ? 'Belum bisa dipesan' : 'Siap dipesan'}
                  </p>
                </div>
              </div>

              {!isDisabled ? (
                <div className="mt-4 flex items-center justify-between gap-4 rounded-[28px] border border-[var(--line)] bg-white px-4 py-3">
                  <p className="text-sm font-semibold text-[var(--text)]">Jumlah</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Kurangi jumlah"
                      onClick={() => {
                        setQty((q) => Math.max(1, q - 1))
                        setAdded(false)
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-base font-bold text-[var(--text)] transition hover:bg-[var(--surface-soft)] disabled:opacity-40"
                      disabled={qty <= 1}
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-[var(--text)]">
                      {qty}
                    </span>
                    <button
                      type="button"
                      aria-label="Tambah jumlah"
                      onClick={() => {
                        setQty((q) => Math.min(maxQty, q + 1))
                        setAdded(false)
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-base font-bold text-[var(--text)] transition hover:bg-[var(--surface-soft)] disabled:opacity-40"
                      disabled={qty >= maxQty}
                    >
                      +
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-[var(--surface)] px-4 py-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Kategori visual
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                    Menu pilihan
                  </p>
                </div>

                <div className="rounded-2xl bg-[var(--surface)] px-4 py-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Stok
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                    {Number(product.stock ?? 0)} tersedia
                  </p>
                </div>

                <div className="rounded-2xl bg-[var(--surface)] px-4 py-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Pengambilan
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                    Cek saat checkout
                  </p>
                </div>
              </div>

              <section className="mt-6">
                <h2 className="text-base font-bold text-[var(--text)]">
                  Deskripsi
                </h2>
                <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                  {product.description?.trim() ||
                    'Produk ini disiapkan untuk memberikan pengalaman rasa yang nyaman, rapi, dan cocok dinikmati kapan saja. Detail tambahan seperti komposisi, ukuran, atau catatan khusus dapat ditanyakan saat pemesanan.'}
                </p>
              </section>

              <section className="mt-6 rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4">
                <h2 className="text-base font-bold text-[var(--text)]">
                  Catatan pemesanan
                </h2>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-muted)]">
                  <li>- Pastikan jumlah dan varian sudah sesuai sebelum melanjutkan checkout.</li>
                  <li>- Metode pengiriman atau pengambilan akan muncul sesuai pengaturan toko.</li>
                  <li>- Foto produk dapat sedikit berbeda tergantung penyajian.</li>
                </ul>
              </section>
            </section>
          </div>
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Harga
            </p>
            <p className="truncate text-base font-bold text-[var(--text)]">
              Rp {formatRupiah(displayPrice)}
            </p>
          </div>

          <Link
            href={backHref}
            className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-soft)]"
          >
            Lihat menu lain
          </Link>

          <ShareButton
            path={pathname}
            title={product.name}
            text={productShareText(product.name, displayPrice)}
            label="Bagikan"
            className="shrink-0 px-3.5 py-3"
          />

          {added && !isDisabled ? (
            <Link
              href="/cart"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(0,0,0,0.18)] transition hover:opacity-95"
            >
              <Check className="h-4 w-4" /> Ditambahkan — Lihat keranjang
            </Link>
          ) : (
            <button
              type="button"
              disabled={isDisabled || checkingAuth}
              onClick={handleOrderNow}
              className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(0,0,0,0.18)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
            >
              {isDisabled
                ? 'Belum tersedia'
                : checkingAuth
                  ? 'Memproses...'
                  : 'Pesan sekarang'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}