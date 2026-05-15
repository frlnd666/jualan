"use client";

import { motion } from "framer-motion";

const cases = [
  {
    name: "Kopi Sore",
    metric: "+38% order mingguan",
    detail:
      "Setelah pakai storefront yang lebih rapi dan link toko yang mudah dibagikan.",
  },
  {
    name: "Batik Jawa",
    metric: "Lebih cepat balas order",
    detail:
      "Checkout WhatsApp membuat pembeli langsung masuk ke percakapan yang tepat.",
  },
  {
    name: "Skincare Glow",
    metric: "Toko lebih meyakinkan",
    detail:
      "Produk terlihat lebih profesional saat dibagikan ke Instagram dan TikTok.",
  },
];

export function SocialProof() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-[var(--primary)]">
            Social Proof
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[var(--text)] sm:text-4xl">
            Contoh hasil yang realistis untuk bisnis kecil yang ingin terlihat
            lebih profesional
          </h2>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[30px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-md)]">
            <p className="text-sm text-[var(--text-muted)]">
              Statistik placeholder
            </p>

            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              <div>
                <p className="text-3xl font-semibold text-[var(--text)]">128+</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Toko aktif demo
                </p>
              </div>
              <div>
                <p className="text-3xl font-semibold text-[var(--text)]">3.4k</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Produk terpublikasi
                </p>
              </div>
              <div>
                <p className="text-3xl font-semibold text-[var(--text)]">94%</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Akses dari mobile
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {cases.map((item, index) => (
              <motion.article
                key={item.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]"
              >
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Case
                </p>

                <h3 className="mt-3 text-lg font-semibold text-[var(--text)]">
                  {item.name}
                </h3>

                <p className="mt-3 text-base font-medium text-[var(--primary)]">
                  {item.metric}
                </p>

                <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                  {item.detail}
                </p>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}