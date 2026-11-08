"use client";

import { motion } from "framer-motion";
import { ClipboardList, Share2, Store, Truck } from "lucide-react";

const steps = [
  {
    icon: Store,
    title: "Daftar & atur toko",
    desc: "Buat akun, isi nama toko, logo, kota, dan nomor WhatsApp. Tokomu langsung punya alamat sendiri, misalnya /kopisore.",
  },
  {
    icon: ClipboardList,
    title: "Tambah produk",
    desc: "Upload foto, tulis harga dan stok. Produk tampil di katalog dan stok berkurang otomatis setiap ada pesanan.",
  },
  {
    icon: Share2,
    title: "Bagikan link toko",
    desc: "Sebar link ke WhatsApp, Instagram, atau TikTok. Pembeli checkout dalam 3 langkah dan menerima halaman invoice-nya sendiri.",
  },
  {
    icon: Truck,
    title: "Verifikasi & kirim",
    desc: "Pembeli upload bukti transfer, kamu verifikasi dari antrean “Perlu tindakan”, lalu input resi. Pembeli memantau statusnya dari halaman invoice yang sama.",
  },
];

export function StepsSection() {
  return (
    <section id="cara-kerja" className="scroll-mt-20 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--primary-deep)]">
            Cara kerja
          </p>
          <h2 className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight text-[var(--text)] sm:text-3xl">
            Dari daftar sampai pesanan terkirim
          </h2>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ y: 14 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.3, delay: index * 0.06 }}
              className="relative rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-deep)]">
                  <step.icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-bold text-[var(--primary-deep)]">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-5 text-base font-semibold text-[var(--text)]">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
