'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  Trash2,
} from 'lucide-react'
import { useCart } from '@/lib/use-cart'
import { createClient } from '@/lib/supabase/client'
import { storeHref } from '@/lib/store-links'
import { platformHosts, platformDomainFromEnv } from '@/lib/domains'

export default function CartPage() {
  const router = useRouter()
  const { items, updateQty, removeItem, clearCart, storeSlug, storeId } =
    useCart()
  const [checkingAuth, setCheckingAuth] = useState(false)
  // Harga promo flash sale yang SEDANG aktif (sama seperti preview
  // checkout): keranjang menyimpan harga normal, promo diterapkan
  // dinamis supaya total di sini tidak pernah basi.
  const [flashPrices, setFlashPrices] = useState<Map<string, number>>(
    new Map()
  )
  // Fase 5 — "Kembali ke toko" tetap di host yang melayani (domain
  // custom/subdomain = root, platform = /{slug}).
  const backHref = storeSlug
    ? storeHref(
        storeSlug,
        '/',
        platformHosts(
          platformDomainFromEnv(process.env.NEXT_PUBLIC_PLATFORM_DOMAIN)
        )
      )
    : '/'

  useEffect(() => {
    async function fetchFlashSales() {
      if (!storeId) return
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('flash_sales')
          .select('product_id, promo_price, starts_at, ends_at, is_active')
          .eq('store_id', storeId)
          .eq('is_active', true)
        if (error || !data) return
        const now = new Date().getTime()
        const map = new Map<string, number>()
        for (const row of data as Array<{
          product_id: string
          promo_price: number
          starts_at: string
          ends_at: string
        }>) {
          const start = new Date(row.starts_at).getTime()
          const end = new Date(row.ends_at).getTime()
          if (Number.isNaN(start) || Number.isNaN(end)) continue
          if (now < start || now > end) continue
          const promo = Math.floor(Number(row.promo_price) || 0)
          if (promo > 0) map.set(row.product_id, promo)
        }
        setFlashPrices(map)
      } catch {
        // Tanpa flash sale = harga normal.
      }
    }
    fetchFlashSales()
  }, [storeId])

  const effectivePrice = (productId: string, base: number) => {
    const promo = flashPrices.get(productId)
    return promo !== undefined && promo > 0 && promo < base ? promo : base
  }

  const subtotalValue = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum +
          effectivePrice(item.product.id, Number(item.product.price)) *
            item.qty,
        0
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, flashPrices]
  )

  // Checkout wajib login: tamu diarahkan daftar sebagai pembeli dulu,
  // lalu kembali ke /checkout. Melihat isi keranjang tetap bebas.
  // Bila cek sesi gagal, biarkan halaman /checkout yang memutuskan
  // (gate server di sana mengarahkan tamu ke register).
  async function handleCheckoutClick() {
    setCheckingAuth(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      router.push(user ? '/checkout' : '/register?type=buyer&next=/checkout')
    } catch {
      router.push('/checkout')
    } finally {
      setCheckingAuth(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-6 pb-28 md:pb-10">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
            Keranjang
          </h1>
          {storeSlug ? (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary)]"
            >
              <ArrowLeft className="h-4 w-4" /> Kembali ke toko
            </Link>
          ) : null}
        </div>

        {items.length === 0 ? (
          <div className="rounded-[32px] border border-dashed border-[var(--line)] bg-[var(--surface)] px-6 py-14 text-center shadow-[var(--shadow-sm)]">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
              <ShoppingBag className="h-7 w-7" />
            </span>
            <p className="mt-4 text-base font-bold text-[var(--text)]">
              Keranjangmu masih kosong
            </p>
            <p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-[var(--text-muted)]">
              Jelajahi toko dan tambahkan produk yang kamu suka — semuanya
              akan muncul di sini.
            </p>
            <Link
              href={backHref}
              className="mt-5 inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--primary-hover)]"
            >
              Mulai belanja
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {items.map((item) => {
                const base = Number(item.product.price)
                const price = effectivePrice(item.product.id, base)
                const onFlash = price < base
                const image = item.product.images?.[0] ?? null
                return (
                  <article
                    key={item.product.id}
                    className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]"
                  >
                    <div className="flex gap-3">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image}
                          alt={item.product.name}
                          className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                        />
                      ) : (
                        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--text-muted)]">
                          <Package className="h-6 w-6" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="line-clamp-2 text-sm font-semibold text-[var(--text)]">
                            {item.product.name}
                          </p>
                          <button
                            type="button"
                            onClick={() => removeItem(item.product.id)}
                            aria-label={`Hapus ${item.product.name} dari keranjang`}
                            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--error)] transition hover:opacity-80"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Hapus
                          </button>
                        </div>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          {onFlash ? (
                            <>
                              <span className="line-through">
                                Rp {base.toLocaleString('id-ID')}
                              </span>{' '}
                              <span className="font-bold text-[var(--primary)]">
                                Rp {price.toLocaleString('id-ID')}
                              </span>{' '}
                              <span className="font-bold text-[var(--primary)]">
                                FLASH SALE
                              </span>
                            </>
                          ) : (
                            <>Rp {base.toLocaleString('id-ID')}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] p-1">
                        <button
                          type="button"
                          onClick={() =>
                            updateQty(item.product.id, item.qty - 1)
                          }
                          aria-label="Kurangi jumlah"
                          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text)] transition hover:bg-[var(--surface-soft)]"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-[var(--text)]">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateQty(
                              item.product.id,
                              Math.min(
                                item.qty + 1,
                                Number(item.product.stock ?? item.qty + 1)
                              )
                            )
                          }
                          aria-label="Tambah jumlah"
                          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text)] transition hover:bg-[var(--surface-soft)]"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-sm font-bold text-[var(--text)]">
                        Rp {(price * item.qty).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>

            <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-muted)]">
                  Subtotal
                </span>
                <span className="text-lg font-bold text-[var(--text)]">
                  Rp {subtotalValue.toLocaleString('id-ID')}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                Ongkir dan voucher dihitung di halaman checkout.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={clearCart}
                  className="rounded-full border border-[var(--line)] py-3 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-soft)]"
                >
                  Kosongkan
                </button>
                <button
                  type="button"
                  onClick={handleCheckoutClick}
                  disabled={checkingAuth}
                  className="rounded-full bg-[var(--primary)] py-3 text-sm font-bold text-white transition hover:bg-[var(--primary-hover)] disabled:opacity-50"
                >
                  {checkingAuth ? 'Memproses…' : 'Checkout'}
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
