"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";

import { LANDING_PHOTOS } from "@/lib/landing-photos";

const bullets = [
  "Dashboard dirancang untuk layar HP: antrean pesanan, verifikasi, dan resi selesai dalam beberapa ketuk.",
  "Bisa ditambahkan ke home screen (PWA) — terasa seperti aplikasi, tanpa perlu download dari Play Store.",
  "Halaman toko dan invoice ringan dibuka dari jaringan seluler, termasuk dari link chat.",
];

export function MobileExperience() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <motion.div
          initial={{ y: 14 }}
          whileInView={{ y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.35 }}
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--primary-deep)]">
            Mobile-first
          </p>
          <h2 className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight text-[var(--text)] sm:text-3xl">
            Tokomu tinggal di HP yang sama dengan chat pelangganmu
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--text-muted)]">
            Mayoritas UMKM mengelola pesanan dari satu HP Android. CUAN
            dibuat untuk itu: tidak ada panel rumit, tidak ada menu
            berlapis — yang perlu dikerjakan selalu tampil duluan.
          </p>

          <ul className="mt-7 space-y-3.5">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex gap-3 text-sm leading-6 text-[var(--text-muted)]">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary-deep)]">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {bullet}
              </li>
            ))}
          </ul>

          <Link
            href="/register?plan=silver-trial"
            className="btn btn-primary mt-8 px-6 py-3 text-sm"
          >
            Coba buat toko dari HP-mu
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <motion.div
          initial={{ y: 14 }}
          whileInView={{ y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ delay: 0.05, duration: 0.35 }}
          className="flex justify-center"
        >
          <div className="w-[290px] rounded-[36px] border border-[var(--line)] bg-[var(--text)] p-2.5 shadow-[var(--shadow-md)]">
            <div className="overflow-hidden rounded-[28px] bg-[var(--surface)]">
              <div className="relative h-40">
                <Image
                  src={LANDING_PHOTOS.coffee}
                  alt="Foto kedai Kopi Sore"
                  fill
                  sizes="290px"
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-3.5 pt-8">
                  <p className="text-base font-bold text-white">Kopi Sore</p>
                  <p className="text-[11px] text-white/85">Serang, Banten</p>
                </div>
              </div>
              <div className="space-y-2.5 p-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={LANDING_PHOTOS.coffee}
                      alt="Foto produk kopi"
                      fill
                      sizes="36px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium capitalize text-[var(--text)]">kopi</p>
                    <p className="text-[11px] text-[var(--text-muted)]">Rp15.000</p>
                  </div>
                  <span className="rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-bold text-white">
                    + Keranjang
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={LANDING_PHOTOS.nasiGoreng}
                      alt="Foto produk nasgor"
                      fill
                      sizes="36px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium capitalize text-[var(--text)]">nasgor</p>
                    <p className="text-[11px] text-[var(--text-muted)]">Rp15.000</p>
                  </div>
                  <span className="rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-bold text-white">
                    + Keranjang
                  </span>
                </div>
                <div className="rounded-full bg-[var(--text)] px-4 py-2.5 text-center text-xs font-semibold text-white">
                  Checkout · 3 langkah
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
