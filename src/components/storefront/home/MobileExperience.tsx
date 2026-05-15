"use client";

import { motion } from "framer-motion";

export function MobileExperience() {
  return (
    <section className="bg-[var(--surface-soft)] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.35 }}
        >
          <p className="text-sm font-medium text-[var(--primary)]">
            Mobile Experience
          </p>

          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[var(--text)] sm:text-4xl">
            Tampil seperti aplikasi mobile modern, bukan sekadar web biasa
          </h2>

          <p className="mt-5 max-w-xl text-base leading-8 text-[var(--text-muted)]">
            Pengalaman mobile jadi fokus utama: storefront rapi, checkout nyaman
            dari HP, dan bisa ditambahkan ke home screen.
          </p>

          <div className="mt-8 space-y-3 text-sm text-[var(--text-muted)]">
            <div className="rounded-[22px] border border-[var(--line)] bg-[var(--surface)] px-5 py-4 shadow-[var(--shadow-sm)]">
              Preview produk dan checkout lebih nyaman di layar kecil.
            </div>
            <div className="rounded-[22px] border border-[var(--line)] bg-[var(--surface)] px-5 py-4 shadow-[var(--shadow-sm)]">
              Seller bisa kelola toko langsung dari smartphone.
            </div>
            <div className="rounded-[22px] border border-[var(--line)] bg-[var(--surface)] px-5 py-4 shadow-[var(--shadow-sm)]">
              Add to home screen bikin platform terasa seperti app.
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ delay: 0.05, duration: 0.35 }}
          className="flex justify-center lg:justify-end"
        >
          <div className="rounded-[36px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-md)]">
            <div className="w-[280px] rounded-[32px] border border-[var(--line)] bg-[var(--bg)] p-3 shadow-[var(--shadow-sm)]">
              <div className="rounded-[28px] bg-[var(--surface)] p-3">
                <div className="h-36 rounded-[24px] border border-[var(--line)] bg-[var(--surface-soft)]" />

                <h3 className="mt-4 text-lg font-semibold text-[var(--text)]">
                  Kopi Sore
                </h3>

                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Cold brew, beans, dan pastry favorit pelanggan.
                </p>

                <div className="mt-4 grid gap-2">
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-3 text-sm text-[var(--text)]">
                    Checkout WhatsApp
                  </div>
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-3 text-sm text-[var(--text)]">
                    Add to home screen
                  </div>
                </div>

                <div className="mt-4 rounded-full bg-[var(--primary)] px-4 py-2.5 text-center text-xs font-medium text-white">
                  Buka Toko di HP
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}