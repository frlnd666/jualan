"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { LANDING_PHOTOS } from "@/lib/landing-photos";

type DemoStore = {
  name: string;
  category: string;
  desc: string;
  photo: string;
  photoAlt: string;
  badge: string;
  live?: boolean;
  href: string;
  cta: string;
};

const stores: DemoStore[] = [
  {
    name: "Kopi Sore",
    category: "Kedai kopi & makanan",
    desc: "Toko asli yang sedang berjalan di Jualan — katalog, checkout, dan invoice-nya bisa kamu coba langsung.",
    photo: LANDING_PHOTOS.coffee,
    photoAlt: "Foto kopi latte art",
    badge: "Toko asli · Live",
    live: true,
    href: "/kopisore",
    cta: "Kunjungi toko",
  },
  {
    name: "Batik Jawa",
    category: "Fashion & batik",
    desc: "Contoh tampilan untuk toko fashion dengan tema Warm (Amber).",
    photo: LANDING_PHOTOS.batik,
    photoAlt: "Foto pria mengenakan kemeja batik Indonesia",
    badge: "Contoh · Tema Warm",
    href: "/register",
    cta: "Buat toko seperti ini",
  },
  {
    name: "Roti Bahagia",
    category: "Bakery & pastry",
    desc: "Contoh tampilan untuk toko roti dengan tema Default (Indigo).",
    photo: LANDING_PHOTOS.bakery,
    photoAlt: "Foto roti dan pastry di etalase bakery",
    badge: "Contoh · Tema Default",
    href: "/register",
    cta: "Buat toko seperti ini",
  },
  {
    name: "Skincare Glow",
    category: "Beauty & skincare",
    desc: "Contoh tampilan untuk toko kecantikan dengan tema Minimal (Slate).",
    photo: LANDING_PHOTOS.skincare,
    photoAlt: "Foto produk skincare natural",
    badge: "Contoh · Tema Minimal",
    href: "/register",
    cta: "Buat toko seperti ini",
  },
];

export function DemoGrid() {
  return (
    <section id="demo" className="scroll-mt-20 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--primary)]">
            Contoh toko
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
            Satu platform, banyak jenis usaha
          </h2>
          <p className="mt-4 text-base leading-7 text-[var(--text-muted)]">
            Setiap toko dapat satu link yang bisa dibagikan ke mana saja.
            Tiga tema tampilan tersedia dan bisa diganti kapan pun dari
            pengaturan toko.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {stores.map((store, index) => (
            <motion.article
              key={store.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              className="flex flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]"
            >
              <div className="relative h-44">
                <Image
                  src={store.photo}
                  alt={store.photoAlt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 280px"
                  className="object-cover"
                />
                <span
                  className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    store.live
                      ? "bg-[var(--success)] text-white"
                      : "bg-white/90 text-[var(--text)]"
                  }`}
                >
                  {store.live ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  ) : null}
                  {store.badge}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-base font-semibold text-[var(--text)]">
                  {store.name}
                </h3>
                <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  {store.category}
                </p>
                <p className="mt-3 flex-1 text-sm leading-6 text-[var(--text-muted)]">
                  {store.desc}
                </p>
                <Link
                  href={store.href}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary)] transition hover:gap-2.5"
                >
                  {store.cta}
                  {store.live ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </Link>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
