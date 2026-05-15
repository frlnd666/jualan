"use client";

import { motion } from "framer-motion";

const steps = [
  { title: "Buat toko", desc: "Isi nama toko, logo, dan identitas brand.", icon: "01" },
  { title: "Upload produk", desc: "Masukkan foto, harga, dan deskripsi produk.", icon: "02" },
  { title: "Bagikan link toko", desc: "Promosikan lewat WhatsApp, TikTok, dan Instagram.", icon: "03" },
  { title: "Terima order", desc: "Pelanggan checkout dan kamu kelola order dari dashboard.", icon: "04" },
];

export function StepsSection() {
  return (
    <section className="bg-[var(--surface-soft)] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-[var(--primary)]">Cara Kerja</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-neutral-950 sm:text-4xl">
            Dari daftar sampai terima order, alurnya sederhana
          </h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[var(--shadow-sm)]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-neutral-950 text-lg font-semibold text-white">
                {step.icon}
              </div>
              <h3 className="mt-5 text-lg font-semibold text-neutral-950">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}