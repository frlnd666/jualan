"use client";

import { motion } from "framer-motion";
import { Link2, ShieldCheck, Smartphone } from "lucide-react";

const pillars = [
  {
    icon: Link2,
    title: "Satu link untuk semua channel",
    desc: "Taruh link tokomu di bio Instagram, status WhatsApp, atau video TikTok. Pembeli membuka katalog yang sama, tanpa perlu install aplikasi.",
  },
  {
    icon: ShieldCheck,
    title: "Data pembeli terlindungi",
    desc: "Halaman invoice memakai token khusus per pesanan dan data pribadi pembeli ditampilkan termasking ke publik. Bukti transfer tersimpan privat, hanya bisa dilihat kamu dan pembelinya.",
  },
  {
    icon: Smartphone,
    title: "Semua dikelola dari HP",
    desc: "Tambah produk, verifikasi pembayaran, sampai input resi — cukup dari browser HP. CUAN adalah PWA, bisa ditambahkan ke home screen seperti aplikasi.",
  },
];

const channels = ["WhatsApp", "Instagram", "TikTok", "Facebook", "Telegram"];

export function TrustSection() {
  return (
    <section className="border-y border-[var(--line)] bg-[var(--surface)] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-[var(--primary-deep)]">
              Kenapa CUAN
            </p>
            <h2 className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight text-[var(--text)] sm:text-3xl">
              Dibangun mengikuti cara UMKM benar-benar berjualan
            </h2>
            <p className="mt-4 text-base leading-7 text-[var(--text-muted)]">
              Bukan marketplace dengan potongan di setiap transaksi. CUAN
              adalah tokomu sendiri: pembeli membayar langsung ke rekening
              atau QRIS kamu, dan kamu yang memegang kendali penuh atas
              katalog, harga, dan pengiriman.
            </p>
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Bagikan link tokomu di
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {channels.map((channel) => (
                  <span
                    key={channel}
                    className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3.5 py-1.5 text-sm font-medium text-[var(--text)]"
                  >
                    {channel}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {pillars.map((pillar, index) => (
              <motion.div
                key={pillar.title}
                initial={{ y: 14 }}
                whileInView={{ y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.3, delay: index * 0.06 }}
                className="flex gap-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-5"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-deep)]">
                  <pillar.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-[var(--text)]">
                    {pillar.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-[var(--text-muted)]">
                    {pillar.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
