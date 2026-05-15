"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const plans = [
  {
    name: "Free",
    price: "Rp0",
    description: "Untuk mulai jualan dan coba storefront.",
    cta: "Mulai Gratis",
    features: [
      "4 produk",
      "WhatsApp checkout",
      "Watermark storefront pada foto produk",
      "Basic analytic",
    ],
  },
  {
    name: "Medium",
    price: "Rp29.000",
    description: "Paling pas untuk UMKM yang ingin tampil lebih rapi.",
    cta: "Pilih Medium",
    featured: true,
    badge: "Paling populer",
    features: [
      "20 produk",
      "Premium theme",
      "Tanpa watermark",
      "Basic analytic",
    ],
  },
  {
    name: "Pro",
    price: "Rp69.000",
    description: "Untuk toko yang ingin scale lebih serius dan terlihat premium.",
    cta: "Pilih Pro",
    features: [
      "Unlimited produk",
      "Nama domain sendiri",
      "Premium theme",
      "Advance analytics",
    ],
  },
];

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="bg-[var(--surface-soft)] px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-[var(--primary)]">Pricing</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[var(--text)] sm:text-4xl">
            Pilih paket yang sesuai dengan tahap tumbuh toko kamu
          </h2>
          <p className="mt-4 text-base leading-8 text-[var(--text-muted)]">
            Mulai dari gratis, lalu upgrade saat katalog, branding, dan kebutuhan
            analitik toko kamu semakin berkembang.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <motion.article
              key={plan.name}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className={`relative rounded-[32px] border p-7 shadow-[var(--shadow-sm)] ${
                plan.featured
                  ? "border-[var(--primary)] bg-[var(--surface)] shadow-[0_18px_50px_rgba(31,26,23,0.08)]"
                  : "border-[var(--line)] bg-[var(--surface)]"
              }`}
            >
              <div className="flex min-h-[32px] items-center justify-between gap-3">
                <p className="text-sm font-medium text-[var(--text-muted)]">
                  {plan.name}
                </p>
                {plan.badge ? (
                  <span className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-medium text-[var(--primary)]">
                    {plan.badge}
                  </span>
                ) : null}
              </div>

              <div className="mt-5">
                <p className="text-4xl font-semibold tracking-tight text-[var(--text)]">
                  {plan.price}
                  <span className="ml-1 text-sm font-medium text-[var(--text-muted)]">
                    /bulan
                  </span>
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                  {plan.description}
                </p>
              </div>

              <div className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <div
                    key={feature}
                    className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text-muted)]"
                  >
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/login"
                className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--primary-hover)]"
              >
                {plan.cta}
              </Link>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}