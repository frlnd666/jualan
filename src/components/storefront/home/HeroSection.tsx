"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, Check, ClipboardCheck, PackageCheck } from "lucide-react";

import { LANDING_PHOTOS } from "@/lib/landing-photos";

const trustPoints = [
  "Tanpa potongan per transaksi",
  "Pembayaran langsung ke rekeningmu",
  "Mulai gratis, upgrade kapan saja",
];

const heroProducts = [
  { name: "kopi", desc: "ini kopi kita", price: "Rp15.000", photo: LANDING_PHOTOS.coffee },
  { name: "nasgor", desc: "nasgor paling gila", price: "Rp15.000", photo: LANDING_PHOTOS.nasiGoreng },
];

export function HeroSection() {
  return (
    <section id="top" className="px-4 pb-16 pt-12 sm:px-6 lg:px-8 lg:pb-24 lg:pt-20">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-medium text-[var(--text-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
            Platform toko online untuk UMKM Indonesia
          </p>

          <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight text-[var(--text)] sm:text-5xl">
            Buka toko online yang rapi. Tanpa perlu jago teknologi.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-7 text-[var(--text-muted)] sm:text-lg sm:leading-8">
            Katalog produk, checkout, invoice, verifikasi pembayaran, sampai
            nomor resi — semuanya terhubung dalam satu dashboard yang bisa
            kamu kelola langsung dari HP.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)]"
            >
              Coba Silver gratis 14 hari
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] px-6 py-3.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-soft)]"
            >
              Buat toko gratis
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--text-muted)]">
            {trustPoints.map((point) => (
              <li key={point} className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-[var(--success)]" />
                {point}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="relative"
        >
          {/* Cuplikan toko asli: Kopi Sore */}
          <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-md)]">
            <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-soft)] px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#e0d5c6]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#e0d5c6]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#e0d5c6]" />
              <span className="ml-2 truncate rounded-md bg-[var(--surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
                jualin-delta.vercel.app/kopisore
              </span>
            </div>

            <div className="relative h-44 sm:h-52">
              <Image
                src={LANDING_PHOTOS.coffee}
                alt="Foto kopi di Kopi Sore"
                fill
                sizes="(max-width: 1024px) 100vw, 560px"
                className="object-cover"
                priority
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-4 pt-10">
                <p className="text-lg font-bold text-white">Kopi Sore</p>
                <p className="text-xs text-white/85">
                  Kedai kopi &amp; makanan · Serang, Banten
                </p>
              </div>
            </div>

            <div className="divide-y divide-[var(--line)]">
              {heroProducts.map((product) => (
                <div key={product.name} className="flex items-center gap-3 px-4 py-3">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={product.photo}
                      alt={`Foto produk ${product.name}`}
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium capitalize text-[var(--text)]">
                      {product.name}
                    </p>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {product.desc}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {product.price}
                  </p>
                </div>
              ))}
            </div>

            <Link
              href="/kopisore"
              className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3 text-sm font-medium text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
            >
              Ini toko asli yang sedang live — coba buka
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Cuplikan antrean dashboard penjual */}
          <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-md)] sm:absolute sm:-bottom-10 sm:-left-10 sm:mt-0 sm:w-80">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Dashboard penjual · Perlu tindakan
            </p>
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2.5">
                <BadgeCheck className="h-5 w-5 shrink-0 text-[var(--warning)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[var(--text)]">
                    Bukti transfer masuk · Rp40.000
                  </p>
                  <p className="truncate text-[11px] text-[var(--text-muted)]">
                    INV-20261107-CN67HRY2CB9H
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--primary)] px-2.5 py-1 text-[11px] font-medium text-white">
                  Verifikasi
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2.5">
                <PackageCheck className="h-5 w-5 shrink-0 text-[var(--success)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[var(--text)]">
                    Pembayaran terkonfirmasi
                  </p>
                  <p className="truncate text-[11px] text-[var(--text-muted)]">
                    Pesanan siap disiapkan &amp; dikirim
                  </p>
                </div>
                <ClipboardCheck className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
