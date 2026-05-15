'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

type Product = {
  id: string
  name: string
  slug: string
  price: number | string
  description?: string | null
  images?: string[] | null
  badge?: string | null
  stock?: number | null
  available?: boolean | null
}

type ProductDetailClientProps = {
  storeSlug: string
  product: Product
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
}: ProductDetailClientProps) {
  const images = useMemo(() => {
    return Array.isArray(product.images) ? product.images.filter(Boolean) : []
  }, [product.images])

  const [activeImage, setActiveImage] = useState(images[0] || '')
  const stockInfo = getStockLabel(product.stock, product.available)

  const isDisabled =
    product.available === false || Number(product.stock ?? 0) <= 0

  return (
    <div className="min-h-screen bg-[#f6f1ea] pb-32 text-[#241b17]">
      <div className="mx-auto max-w-4xl">
        <div className="px-4 pt-4 sm:px-6">
          <Link
            href={`/${storeSlug}`}
            className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[#241b17] shadow-[0_8px_20px_rgba(33,24,20,0.05)] transition hover:bg-[#faf6f1]"
          >
            <span aria-hidden="true">←</span>
            Kembali ke toko
          </Link>
        </div>

        <main className="px-4 pb-8 pt-4 sm:px-6">
          <div className="overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-[0_16px_40px_rgba(33,24,20,0.07)]">
            <section className="relative bg-[#efe7de]">
              <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[16/10]">
                {activeImage ? (
                  <img
                    src={activeImage}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top,#f4dcc8,_#ead7c6_50%,_#dfcbba_100%)] px-6 text-center">
                    <span className="text-5xl">☕</span>
                    <p className="mt-4 text-sm font-medium text-[#7a6b5f]">
                      Foto produk akan segera ditambahkan
                    </p>
                  </div>
                )}
              </div>

              {product.badge ? (
                <div className="absolute left-4 top-4">
                  <span className="rounded-full bg-[#2f241f] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white shadow-lg">
                    {product.badge}
                  </span>
                </div>
              ) : null}
            </section>

            {images.length > 1 ? (
              <section className="border-t border-black/5 bg-[#fcfaf7] px-4 py-4 sm:px-6">
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
                            ? 'border-[#5b3df5] ring-2 ring-[#5b3df5]/15'
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
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8d7f73]">
                    Detail produk
                  </p>
                  <h1 className="mt-2 text-2xl font-bold leading-tight text-[#241b17]">
                    {product.name}
                  </h1>
                </div>

                <span
                  className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${stockInfo.className}`}
                >
                  {stockInfo.text}
                </span>
              </div>

              <div className="mt-4 flex items-end justify-between gap-4 rounded-[28px] bg-[#f7f1eb] px-4 py-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8d7f73]">
                    Harga
                  </p>
                  <p className="mt-1 text-2xl font-bold text-[#5b3df5]">
                    Rp {formatRupiah(product.price)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8d7f73]">
                    Status
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#241b17]">
                    {isDisabled ? 'Belum bisa dipesan' : 'Siap dipesan'}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-[#fcfaf7] px-4 py-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#8d7f73]">
                    Kategori visual
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#241b17]">
                    Menu pilihan
                  </p>
                </div>

                <div className="rounded-2xl bg-[#fcfaf7] px-4 py-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#8d7f73]">
                    Stok
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#241b17]">
                    {Number(product.stock ?? 0)} tersedia
                  </p>
                </div>

                <div className="rounded-2xl bg-[#fcfaf7] px-4 py-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#8d7f73]">
                    Pengambilan
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#241b17]">
                    Cek saat checkout
                  </p>
                </div>
              </div>

              <section className="mt-6">
                <h2 className="text-base font-bold text-[#241b17]">
                  Deskripsi
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#6f6258]">
                  {product.description?.trim() ||
                    'Produk ini disiapkan untuk memberikan pengalaman rasa yang nyaman, rapi, dan cocok dinikmati kapan saja. Detail tambahan seperti komposisi, ukuran, atau catatan khusus dapat ditanyakan saat pemesanan.'}
                </p>
              </section>

              <section className="mt-6 rounded-[28px] border border-[#eadfd4] bg-[#fffaf5] p-4">
                <h2 className="text-base font-bold text-[#241b17]">
                  Catatan pemesanan
                </h2>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-[#6f6258]">
                  <li>- Pastikan jumlah dan varian sudah sesuai sebelum melanjutkan checkout.</li>
                  <li>- Metode pengiriman atau pengambilan akan muncul sesuai pengaturan toko.</li>
                  <li>- Foto produk dapat sedikit berbeda tergantung penyajian.</li>
                </ul>
              </section>
            </section>
          </div>
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-[#fffaf5]/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8d7f73]">
              Harga
            </p>
            <p className="truncate text-base font-bold text-[#241b17]">
              Rp {formatRupiah(product.price)}
            </p>
          </div>

          <Link
            href={`/${storeSlug}`}
            className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm font-semibold text-[#241b17] transition hover:bg-[#faf6f1]"
          >
            Lihat menu lain
          </Link>

          <button
            type="button"
            disabled={isDisabled}
            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-[#5b3df5] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(91,61,245,0.24)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
          >
            {isDisabled ? 'Belum tersedia' : 'Pesan sekarang'}
          </button>
        </div>
      </div>
    </div>
  )
}