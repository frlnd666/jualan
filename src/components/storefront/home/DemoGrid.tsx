"use client";

import { motion } from "framer-motion";

const stores = [
  { name: "Kopi Sore", tag: "Coffee" },
  { name: "Batik Jawa", tag: "Fashion" },
  { name: "Roti Bahagia", tag: "Bakery" },
  { name: "Skincare Glow", tag: "Beauty" },
];

export function DemoGrid() {
  return (
    <section id="demo" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-[var(--primary)]">
            Showcase Demo Toko
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[var(--text)] sm:text-4xl">
            Lihat bagaimana storefront tampil modern untuk berbagai jenis UMKM
          </h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {stores.map((store, index) => (
            <motion.article
              key={store.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              className="overflow-hidden rounded-[30px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]"
            >
              <div className="border-b border-[var(--line)] bg-[var(--surface-soft)] p-5">
                <div className="flex items-start justify-between">
                  <div className="rounded-2xl bg-[var(--stone)] px-3 py-1 text-xs font-medium text-[var(--text)]">
                    {store.tag}
                  </div>
                  <div className="h-12 w-12 rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]" />
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[var(--text)]">
                    {store.name}
                  </h3>
                  <span className="text-xs text-[var(--text-muted)]">
                    Live demo
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="h-16 rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)]" />
                  <div className="h-16 rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)]" />
                  <div className="h-16 rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)]" />
                </div>

                <div className="mt-4 rounded-[20px] border border-[var(--line)] bg-[var(--surface-soft)] p-3">
                  <div className="h-2.5 w-24 rounded-full bg-[var(--text)]" />
                  <div className="mt-2 h-2 w-full rounded-full bg-[var(--stone)]" />
                  <div className="mt-2 h-2 w-4/5 rounded-full bg-[var(--stone)]" />
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}