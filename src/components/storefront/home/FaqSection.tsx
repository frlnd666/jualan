"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

const faqs = [
  {
    question: "Apakah harus bisa coding?",
    answer: "Tidak. Seller bisa membuat toko, upload produk, dan mulai jualan tanpa setup teknis yang rumit.",
  },
  {
    question: "Apakah bisa dipakai di HP?",
    answer: "Bisa. Semua tampilan dirancang mobile-first supaya seller dan pembeli nyaman mengakses dari smartphone.",
  },
  {
    question: "Apakah bisa pakai domain sendiri?",
    answer: "Bisa di plan Pro, sehingga toko terlihat lebih profesional dan lebih mudah dipercaya pelanggan.",
  },
  {
    question: "Apakah bisa checkout WhatsApp?",
    answer: "Bisa. WhatsApp checkout jadi salah satu alur utama agar pelanggan lebih cepat menghubungi seller dan menyelesaikan order.",
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-[var(--primary)]">FAQ</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-neutral-950 sm:text-4xl">
            Pertanyaan yang paling sering ditanyakan UMKM
          </h2>
        </div>
        <div className="mt-10 space-y-4">
          {faqs.map((faq, index) => {
            const active = open === index;
            return (
              <div key={faq.question} className="rounded-[28px] border border-black/5 bg-white shadow-[var(--shadow-sm)]">
                <button
                  type="button"
                  onClick={() => setOpen(active ? null : index)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <span className="text-base font-medium text-neutral-950">{faq.question}</span>
                  <span className="text-xl text-[var(--text-muted)]">{active ? "−" : "+"}</span>
                </button>
                <AnimatePresence initial={false}>
                  {active ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-6 text-sm leading-7 text-[var(--text-muted)]">{faq.answer}</p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}