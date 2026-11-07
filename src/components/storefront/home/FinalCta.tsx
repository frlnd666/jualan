"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function FinalCta() {
  return (
    <>
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-3xl bg-[var(--text)] px-6 py-14 text-center sm:px-12 lg:py-16">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Tokomu berikutnya cuma sejauh satu link
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-white/70">
            Daftar, tambah produk pertamamu, dan bagikan linknya. Lima menit
            dari sekarang, pelangganmu bisa checkout sendiri tanpa menunggu
            kamu membalas chat.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)]"
            >
              Buat toko gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/kopisore"
              className="inline-flex items-center justify-center rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Lihat toko yang sudah live
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--line)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-[var(--text-muted)] sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary)] text-xs font-bold text-white">
              J
            </span>
            <span className="font-semibold text-[var(--text)]">Jualan</span>
            <span>· Platform toko online untuk UMKM Indonesia</span>
          </div>
          <nav className="flex items-center gap-5">
            <Link href="/kopisore" className="transition hover:text-[var(--text)]">
              Toko contoh
            </Link>
            <Link href="/login" className="transition hover:text-[var(--text)]">
              Masuk
            </Link>
            <Link href="/register" className="transition hover:text-[var(--text)]">
              Daftar
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
