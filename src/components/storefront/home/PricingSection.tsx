"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";

const included = [
  "Toko online dengan alamat sendiri",
  "Katalog produk & stok otomatis",
  "Checkout 3 langkah + halaman invoice per pesanan",
  "Upload & verifikasi bukti transfer",
  "Pengiriman dengan nomor resi",
  "Chat pembeli & 3 tema tampilan",
];

export function PricingSection() {
  return (
    <section id="harga" className="scroll-mt-20 border-y border-[var(--line)] bg-[var(--surface)] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_420px] lg:gap-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-[var(--primary)]">
              Harga
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
              Gratis. Tanpa potongan per transaksi.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-[var(--text-muted)]">
              Jualan masih dalam tahap awal dan saat ini gratis dipakai
              dengan semua fitur intinya. Tidak ada biaya bulanan, tidak
              ada komisi dari penjualanmu — uang pembeli masuk langsung ke
              rekening atau QRIS kamu, sama seperti jualan lewat chat,
              hanya jauh lebih rapi.
            </p>
            <p className="mt-4 max-w-xl text-base leading-7 text-[var(--text-muted)]">
              Kalau suatu hari ada paket berbayar, fitur yang kamu pakai
              sekarang tidak akan dikunci diam-diam.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-7 shadow-[var(--shadow-sm)]"
          >
            <p className="text-sm font-semibold text-[var(--text)]">
              Semua fitur inti
            </p>
            <p className="mt-4 flex items-end gap-2">
              <span className="text-4xl font-bold tracking-tight text-[var(--text)]">
                Rp0
              </span>
              <span className="pb-1 text-sm text-[var(--text-muted)]">
                / selamanya untuk fitur inti
              </span>
            </p>

            <ul className="mt-6 space-y-3 border-t border-[var(--line)] pt-6">
              {included.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm leading-6 text-[var(--text-muted)]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/register"
              className="mt-7 flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)]"
            >
              Buat toko gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
              Tanpa kartu kredit. Tokomu online dalam beberapa menit.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
