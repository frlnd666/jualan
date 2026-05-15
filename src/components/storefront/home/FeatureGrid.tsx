"use client";

import { motion } from "framer-motion";

const features = [
  {
    title: "Smart Storefront",
    desc: "Halaman toko tampil modern, rapi, dan lebih meyakinkan saat dibagikan ke pelanggan.",
  },
  {
    title: "WhatsApp Checkout",
    desc: "Pelanggan bisa langsung lanjut order lewat alur checkout yang familiar dan cepat.",
  },
  {
    title: "Invoice Otomatis",
    desc: "Ringkas proses administrasi dengan invoice yang langsung siap dipakai setelah order masuk.",
  },
  {
    title: "Pilih Kurir",
    desc: "Seller bisa menyesuaikan opsi pengiriman sesuai kebutuhan operasional toko.",
  },
  {
    title: "Dashboard Simpel",
    desc: "Kelola produk, order, dan aktivitas toko dari tampilan yang ringan dan mudah dipahami.",
  },
  {
    title: "Internal Chat",
    desc: "Komunikasi antar tim dan seller jadi lebih rapi tanpa berpindah ke banyak tools lain.",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-[var(--primary)]">Features</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[var(--text)] sm:text-4xl">
            Fitur penting untuk bikin toko online yang terasa profesional
          </h2>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature, index) => (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.3, delay: index * 0.04 }}
              className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)]">
                0{index + 1}
              </div>

              <h3 className="mt-5 text-lg font-semibold text-[var(--text)]">
                {feature.title}
              </h3>

              <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                {feature.desc}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}