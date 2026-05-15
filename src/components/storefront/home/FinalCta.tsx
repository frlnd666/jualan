"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function FinalCta() {
  return (
    <>
      <section className="px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.35 }}
          className="mx-auto max-w-7xl overflow-hidden rounded-[36px] border border-[var(--line)] bg-[var(--surface)] px-6 py-12 shadow-[var(--shadow-md)] sm:px-10 lg:px-14"
        >
          <div className="max-w-3xl">
            <p className="text-sm text-[var(--text-muted)]">Mulai sekarang</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[var(--text)] sm:text-4xl">
              Mulai Jualan Online dengan Tampilan Profesional
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--text-muted)]">
              Bikin toko online yang mudah dibagikan, nyaman dipakai dari HP,
              dan terlihat lebih meyakinkan untuk pelanggan baru.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-flex rounded-full bg-[var(--primary)] px-6 py-3.5 text-sm font-medium text-white transition hover:bg-[var(--primary-hover)]"
            >
              Buat Toko Gratis
            </Link>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-[var(--line)] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.14em] text-[var(--text)]">
              UMKM Storefront
            </p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Platform SaaS multi-tenant untuk UMKM Indonesia.
            </p>
          </div>

          <div className="flex flex-wrap gap-5 text-sm text-[var(--text-muted)]">
            <Link href="#features">Features</Link>
            <Link href="#demo">Demo</Link>
            <Link href="#pricing">Pricing</Link>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Instagram
            </a>
          </div>

          <p className="text-sm text-[var(--text-muted)]">
            © 2026 UMKM Storefront. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  );
}