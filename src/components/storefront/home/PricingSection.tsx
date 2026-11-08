"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, X } from "lucide-react";

type TierFeature = { text: string; included: boolean };

type Tier = {
  name: string;
  price: string;
  period: string;
  desc: string;
  cta: string;
  ctaNote: string;
  popular: boolean;
  features: TierFeature[];
};

const tiers: Tier[] = [
  {
    name: "Free",
    price: "Rp0",
    period: "/ selamanya",
    desc: "Buat coba jualan dan merasakan tokonya dulu.",
    cta: "Buat toko gratis",
    ctaNote: "Tanpa kartu kredit.",
    popular: false,
    features: [
      { text: "4 produk", included: true },
      { text: "1 foto per produk, ada watermark platform", included: true },
      { text: "Pembayaran COD saja", included: true },
      { text: "Ambil di tempat + kurir toko", included: true },
      { text: "Iklan affiliate tampil di banner toko", included: true },
      { text: "Analitik dasar", included: true },
      { text: "Voucher & flash sale", included: false },
      { text: "QRIS dinamis & transfer bank", included: false },
      { text: "Ongkir berbasis berat / kurir", included: false },
      { text: "Staff toko", included: false },
    ],
  },
  {
    name: "Silver",
    price: "Rp19.900",
    period: "/ bulan",
    desc: "Paket utama untuk toko yang sudah serius jualan.",
    cta: "Coba Silver gratis 14 hari",
    ctaNote: "Trial 14 hari, tanpa kartu kredit.",
    popular: true,
    features: [
      { text: "30 produk", included: true },
      { text: "5 foto per produk, tanpa watermark", included: true },
      { text: "COD + transfer + QRIS dinamis", included: true },
      { text: "Ongkir berbasis berat / kurir", included: true },
      { text: "Voucher & flash sale", included: true },
      { text: "Tanpa iklan affiliate", included: true },
      { text: "Analitik lengkap", included: true },
      { text: "1 staff toko", included: true },
      { text: "Ekspor data analitik", included: false },
      { text: "Custom domain", included: false },
    ],
  },
  {
    name: "Gold",
    price: "Rp50.000",
    period: "/ 3 bulan",
    desc: "Untuk toko besar yang butuh kapasitas dan domain sendiri.",
    cta: "Pilih Gold",
    ctaNote: "Setara Rp16.667 / bulan.",
    popular: false,
    features: [
      { text: "175 produk", included: true },
      { text: "10 foto per produk, tanpa watermark", included: true },
      { text: "COD + transfer + QRIS dinamis", included: true },
      { text: "Ongkir berbasis berat / kurir", included: true },
      { text: "Voucher & flash sale", included: true },
      { text: "Tanpa iklan affiliate", included: true },
      { text: "Analitik lengkap + ekspor data", included: true },
      { text: "3 staff toko", included: true },
      { text: "Custom domain (domain dibeli penjual)", included: true },
      { text: "Semua fitur Silver", included: true },
    ],
  },
];

export function PricingSection() {
  return (
    <section id="harga" className="scroll-mt-20 border-y border-[var(--line)] bg-[var(--surface)] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--primary)]">
            Harga
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
            Mulai gratis. Upgrade kapan saja.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[var(--text-muted)]">
            Tidak ada potongan per transaksi di semua paket — uang pembeli
            masuk langsung ke rekening atau QRIS kamu. Pilih paket yang
            sesuai dengan ukuran tokomu, dan naik paket kapan pun tokomu
            bertumbuh.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {tiers.map((tier, index) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.3, delay: index * 0.08 }}
              className={`relative rounded-2xl border bg-[var(--bg)] p-7 shadow-[var(--shadow-sm)] ${
                tier.popular
                  ? "border-[var(--primary)] ring-2 ring-[var(--primary)]"
                  : "border-[var(--line)]"
              }`}
            >
              {tier.popular ? (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--primary)] px-3.5 py-1 text-xs font-semibold text-white">
                  Paling populer
                </span>
              ) : null}
              <p className="text-sm font-semibold text-[var(--text)]">
                {tier.name}
              </p>
              <p className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-bold tracking-tight text-[var(--text)]">
                  {tier.price}
                </span>
                <span className="pb-1 text-sm text-[var(--text-muted)]">
                  {tier.period}
                </span>
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                {tier.desc}
              </p>

              <ul className="mt-6 space-y-3 border-t border-[var(--line)] pt-6">
                {tier.features.map((feature) => (
                  <li
                    key={feature.text}
                    className="flex gap-2.5 text-sm leading-6 text-[var(--text-muted)]"
                  >
                    {feature.included ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
                    ) : (
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)] opacity-50" />
                    )}
                    <span className={feature.included ? "" : "opacity-60"}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className={`mt-7 flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white transition ${
                  tier.popular
                    ? "bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
                    : "bg-[var(--text)] hover:opacity-90"
                }`}
              >
                {tier.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
                {tier.ctaNote}
              </p>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm leading-6 text-[var(--text-muted)]">
          Semua paket tanpa komisi per transaksi. Kalau langganan habis,
          tokomu otomatis turun ke Free — produk di atas 4 disembunyikan,
          bukan dihapus, dan datamu tetap aman.
        </p>
      </div>
    </section>
  );
}
