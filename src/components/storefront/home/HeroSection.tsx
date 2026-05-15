"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const products = [
  { name: "Arabica Gayo", price: "Rp45.000" },
  { name: "Latte Bottle", price: "Rp22.000" },
  { name: "Croissant Butter", price: "Rp18.000" },
];

export function HeroSection() {
  return (
    <section id="top" className="px-4 pb-20 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-14">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="max-w-2xl"
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-medium text-[var(--text-muted)] shadow-[var(--shadow-sm)]">
            <span className="h-2 w-2 rounded-full bg-[var(--olive)]" />
            Cocok untuk UMKM, reseller, dan seller TikTok Shop
          </div>

          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.04em] text-[var(--text)] sm:text-5xl lg:text-6xl">
            Bikin Toko Online Modern untuk UMKM dalam Hitungan Menit
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--text-muted)] sm:text-lg">
            Jualan lebih profesional dengan storefront modern, checkout WhatsApp,
            invoice otomatis, dan dashboard simpel.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-6 py-3.5 text-sm font-medium text-white shadow-[var(--shadow-md)] transition hover:bg-[var(--primary-hover)]"
            >
              Mulai Gratis
            </Link>
            <Link
              href="#demo"
              className="inline-flex items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] px-6 py-3.5 text-sm font-medium text-[var(--text)] shadow-[var(--shadow-sm)] transition hover:bg-[var(--surface-soft)]"
            >
              Lihat Demo
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 text-sm text-[var(--text-muted)]">
            <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2">
              Tanpa coding
            </span>
            <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2">
              Mobile-first
            </span>
            <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2">
              Bisa mulai gratis
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.45 }}
          className="relative"
        >
          <div className="relative grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-md)]">
              <div className="overflow-hidden rounded-[24px] border border-[var(--line)] bg-[var(--surface)]">
                <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold text-[var(--text)]">
                      Kopi Sore
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      umkmstore.id/kopisore
                    </p>
                  </div>
                  <div className="rounded-full bg-[var(--stone)] px-3 py-1 text-[11px] font-medium text-[var(--text)]">
                    Storefront
                  </div>
                </div>

                <div className="grid gap-3 p-4">
                  <div className="rounded-[20px] border border-[var(--line)] bg-[var(--surface-soft)] p-5">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--primary)]">
                      Promo hari ini
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">
                      Biji kopi lokal, tampil lebih premium.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {products.map((product) => (
                      <div
                        key={product.name}
                        className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)] last:col-span-2"
                      >
                        <div className="h-24 rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)]" />
                        <p className="mt-3 text-sm font-medium text-[var(--text)]">
                          {product.name}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          {product.price}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-md)]">
                <div className="rounded-[22px] border border-[var(--line)] bg-[var(--surface-soft)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Dashboard seller
                  </p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Order baru
                      </p>
                      <p className="mt-1 text-lg font-semibold text-[var(--text)]">
                        12 hari ini
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Produk aktif
                      </p>
                      <p className="mt-1 text-lg font-semibold text-[var(--text)]">
                        48 produk
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-md)]">
                <div className="rounded-[22px] bg-[var(--surface-soft)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Preview mobile
                  </p>
                  <div className="mx-auto mt-4 w-40 rounded-[26px] border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[var(--shadow-sm)]">
                    <div className="rounded-[22px] bg-[var(--surface)] p-3">
                      <div className="h-24 rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)]" />
                      <div className="mt-3 h-3 w-20 rounded-full bg-[var(--text)]" />
                      <div className="mt-2 h-2.5 w-24 rounded-full bg-[var(--stone)]" />
                      <div className="mt-4 rounded-full bg-[var(--primary)] px-3 py-2 text-center text-[11px] font-medium text-white">
                        Checkout WhatsApp
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}