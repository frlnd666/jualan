"use client";

import { motion } from "framer-motion";

const items = [
  {
    title: "Tidak perlu coding",
    desc: "Cukup isi data toko, upload produk, lalu langsung online.",
    size: "lg:col-span-2",
  },
  {
    title: "Bisa langsung jualan",
    desc: "Storefront sudah siap dipakai tanpa setup teknis yang rumit.",
  },
  {
    title: "Checkout WhatsApp otomatis",
    desc: "Pelanggan checkout lebih cepat dengan alur yang sudah familiar.",
  },
  {
    title: "Cocok untuk TikTok Shop",
    desc: "Bisa dipakai sebagai link toko utama untuk promosi dan konten.",
  },
  {
    title: "Mobile friendly",
    desc: "Semua tampilan dirancang nyaman dipakai langsung dari HP.",
  },
  {
    title: "Gratis mulai",
    desc: "Mulai dengan plan gratis sebelum upgrade ke fitur yang lebih lengkap.",
  },
];

export function TrustSection() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-[var(--primary)]">Benefit</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[var(--text)] sm:text-4xl">
            Kenapa UMKM Suka Platform Ini?
          </h2>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.3, delay: index * 0.04 }}
              className={`rounded-[30px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] ${item.size ?? ""}`}
            >
              <div className="inline-flex rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-medium text-[var(--primary)]">
                Benefit
              </div>
              <h3 className="mt-4 text-xl font-semibold text-[var(--text)]">
                {item.title}
              </h3>
              <p className="mt-3 max-w-md text-sm leading-7 text-[var(--text-muted)]">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}