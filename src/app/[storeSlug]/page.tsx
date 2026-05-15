import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

type StorefrontPageProps = {
  params: Promise<{
    storeSlug: string
  }>
}

function formatRupiah(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0)
  if (Number.isNaN(numeric)) return '0'
  return numeric.toLocaleString('id-ID')
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const { storeSlug } = await params
  const supabase = await createClient()

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('*')
    .eq('slug', storeSlug)
    .maybeSingle()

  if (storeError || !store) {
    notFound()
  }

  const { data: products } = await supabase
    .from('products')
    .select('id, name, slug, price, images, badge, description')
    .eq('store_id', store.id)
    .eq('available', true)
    .order('created_at', { ascending: false })

  const productList = products ?? []
  const totalProducts = productList.length
  const featuredProducts = productList.slice(0, 2)

  return (
    <div className="min-h-screen bg-[#f6f1ea] pb-24 text-zinc-900">
      <div className="mx-auto max-w-4xl">
        <section className="relative overflow-hidden bg-[#2f241f] text-white">
          {store.banner_url ? (
            <>
              <img
                src={store.banner_url}
                alt={store.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/45 to-[#2f241f]/95" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(255,210,160,0.18),_transparent_24%),linear-gradient(135deg,#4b342b_0%,#2f241f_52%,#211814_100%)]" />
              <div className="absolute right-[-40px] top-[-10px] h-40 w-40 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute bottom-[-50px] left-[-30px] h-44 w-44 rounded-full bg-amber-300/10 blur-3xl" />
            </>
          )}

          <div className="relative px-4 pb-8 pt-6 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/80 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Toko buka
              </div>

              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                Kembali
              </Link>
            </div>

            <div className="mt-10 flex items-end gap-4">
              {store.logo_url ? (
                <img
                  src={store.logo_url}
                  alt={store.name}
                  className="h-16 w-16 rounded-[22px] border border-white/15 object-cover shadow-lg"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/15 bg-white/10 text-lg font-bold text-white shadow-lg backdrop-blur">
                  {getInitials(store.name)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/60">
                  Storefront
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
                  {store.name}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
                  {store.description?.trim() || 'Produk pilihan yang disiapkan rapi, cepat, dan siap dipesan.'}
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3 backdrop-blur">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/55">
                  Produk
                </p>
                <p className="mt-1 text-lg font-bold text-white">{totalProducts}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3 backdrop-blur">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/55">
                  Highlight
                </p>
                <p className="mt-1 text-lg font-bold text-white">
                  {featuredProducts.length}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3 backdrop-blur">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/55">
                  Siap order
                </p>
                <p className="mt-1 text-lg font-bold text-white">Hari ini</p>
              </div>
            </div>
          </div>
        </section>

        <main className="px-4 pb-8 pt-5 sm:px-6">
          {featuredProducts.length > 0 ? (
            <section className="mb-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8d7f73]">
                    Pilihan
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-[#241b17]">
                    Rekomendasi toko
                  </h2>
                </div>
              </div>

              <div className="grid gap-3">
                {featuredProducts.map((product) => (
                  <Link
                    key={`featured-${product.id}`}
                    href={`/${store.slug}/products/${product.slug}`}
                    className="overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_12px_30px_rgba(33,24,20,0.06)] transition hover:-translate-y-0.5"
                  >
                    <div className="grid grid-cols-[112px_1fr]">
                      <div className="relative h-full min-h-[112px] bg-[#efe6dc]">
                        {product.images?.[0] ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#f3d9bf,_#e7d5c5_45%,_#dbc6b5_100%)]">
                            <span className="text-2xl">☕</span>
                          </div>
                        )}

                        {product.badge ? (
                          <span className="absolute left-2 top-2 rounded-full bg-[#2f241f] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                            {product.badge}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex min-w-0 flex-col justify-between p-4">
                        <div>
                          <p className="line-clamp-1 text-base font-bold text-[#241b17]">
                            {product.name}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#7a6b5f]">
                            {product.description?.trim() || 'Menu pilihan dengan rasa yang dibuat untuk dinikmati kapan saja.'}
                          </p>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <p className="text-sm font-bold text-[#5b3df5]">
                            Rp {formatRupiah(product.price)}
                          </p>
                          <span className="inline-flex items-center justify-center rounded-full bg-[#f3efe9] px-3 py-1.5 text-xs font-semibold text-[#241b17]">
                            Lihat
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8d7f73]">
                  Menu
                </p>
                <h2 className="mt-1 text-lg font-bold text-[#241b17]">
                  Semua produk
                </h2>
              </div>

              <p className="text-xs font-medium text-[#8d7f73]">
                {totalProducts} item
              </p>
            </div>

            {productList.length === 0 ? (
              <div className="rounded-[32px] border border-dashed border-[#d9cec3] bg-white px-6 py-10 text-center shadow-[0_10px_24px_rgba(33,24,20,0.04)]">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f3eee8] text-2xl">
                  🍽️
                </div>
                <p className="mt-4 text-base font-bold text-[#241b17]">
                  Belum ada produk tersedia
                </p>
                <p className="mt-2 text-sm leading-6 text-[#7a6b5f]">
                  Toko ini belum menampilkan produk yang siap dipesan saat ini.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {productList.map((product) => (
                  <Link
                    key={product.id}
                    href={`/${store.slug}/products/${product.slug}`}
                    className="group overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_12px_30px_rgba(33,24,20,0.06)] transition hover:-translate-y-0.5"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-[#efe7de]">
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top,#f5dfcb,_#eadacc_50%,_#dfccbb_100%)] px-4 text-center">
                          <span className="text-3xl">☕</span>
                          <span className="mt-3 text-xs font-medium text-[#7a6b5f]">
                            Foto segera hadir
                          </span>
                        </div>
                      )}

                      {product.badge ? (
                        <span className="absolute left-3 top-3 rounded-full bg-[#2f241f] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white shadow-sm">
                          {product.badge}
                        </span>
                      ) : null}
                    </div>

                    <div className="p-3.5">
                      <p className="line-clamp-2 min-h-[2.75rem] text-sm font-bold leading-5 text-[#241b17]">
                        {product.name}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-[#5b3df5]">
                          Rp {formatRupiah(product.price)}
                        </p>
                        <span className="rounded-full bg-[#f4efe9] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6d5f54]">
                          Detail
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}