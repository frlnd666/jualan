"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "Bagaimana pembeli membayar?",
    a: "Tergantung paket tokomu. Di paket Free, pembeli hanya bisa membayar dengan COD. Di paket Silver dan Gold, pembeli bisa memilih COD, transfer bank, atau QRIS dinamis. Setelah pesanan dibuat, halaman invoice menampilkan panduan pembayaran dan formulir upload bukti transfer. Kamu memeriksa bukti itu dari dashboard, lalu mengonfirmasi — status di halaman pembeli berubah seketika.",
  },
  {
    q: "Apakah Jualan memotong hasil penjualan saya?",
    a: "Tidak. Jualan tidak memegang uang pembeli sama sekali dan tidak mengambil komisi per transaksi di semua paket. Pembayaran masuk langsung ke rekening atau QRIS kamu. Yang kamu bayar hanya langganan paket Silver atau Gold kalau kamu memilihnya — paket Free tetap gratis.",
  },
  {
    q: "Apa bedanya Free, Silver, dan Gold?",
    a: "Free (Rp0) untuk coba jualan: 4 produk, 1 foto per produk dengan watermark, pembayaran COD saja, pengiriman ambil di tempat dan kurir toko, serta ada iklan affiliate di banner toko. Silver (Rp19.900/bulan) membuka semua fitur premium: 30 produk, 5 foto per produk tanpa watermark, COD + transfer + QRIS dinamis, ongkir berbasis berat/kurir, voucher dan flash sale, analitik lengkap, dan 1 staff — dengan trial gratis 14 hari. Gold (Rp50.000/3 bulan) seperti Silver, ditambah 175 produk, 10 foto per produk, ekspor analitik, 3 staff, dan custom domain (domain dibeli penjual sendiri).",
  },
  {
    q: "Apa yang terjadi kalau langganan saya habis?",
    a: "Tokomu otomatis turun ke paket Free, bukan hilang. Produk di atas batas Free (4 produk) disembunyikan dari storefront — bukan dihapus — begitu juga foto tambahan, voucher, dan flash sale yang aktif dijeda, dan custom domain dilepas. Datamu tetap aman, dan semuanya kembali seperti semula kalau kamu memperpanjang langganan.",
  },
  {
    q: "Saya tidak bisa coding. Bisakah saya memakainya?",
    a: "Bisa — memang untuk itu Jualan dibuat. Kamu cukup mendaftar, mengisi profil toko, dan menambah produk lewat formulir biasa. Tidak ada yang perlu di-install dan tidak ada pengaturan teknis.",
  },
  {
    q: "Bagaimana ongkos kirim ditentukan?",
    a: "Kamu mengatur sendiri metode pengiriman dan tarifnya dari dashboard (misalnya kurir lokal, ekspedisi, atau ambil di tempat). Tarif yang kamu atur itulah yang muncul saat pembeli checkout, dan setelah paket dikirim kamu tinggal memasukkan nomor resinya.",
  },
  {
    q: "Bisakah semua ini dikelola dari HP?",
    a: "Ya. Dashboard dan halaman toko dirancang mobile-first dan Jualan adalah PWA — bisa ditambahkan ke home screen HP dan dibuka seperti aplikasi, tanpa download dari Play Store.",
  },
  {
    q: "Apakah data pembeli saya aman?",
    a: "Halaman invoice setiap pesanan dilindungi token acak dan data pribadi pembeli (nomor WhatsApp, alamat) ditampilkan termasking ke publik. Bukti transfer tersimpan di penyimpanan privat — hanya kamu dan pembeli yang bersangkutan yang bisa melihatnya.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-20 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--primary)]">
            FAQ
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
            Yang sering ditanyakan
          </h2>
        </div>

        <div className="mt-10 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-6 shadow-[var(--shadow-sm)]">
          {faqs.map((faq, index) => {
            const open = openIndex === index;
            return (
              <div key={faq.q}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : index)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="text-base font-semibold text-[var(--text)]">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {open ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden"
                    >
                      <p className="pb-5 text-sm leading-7 text-[var(--text-muted)]">
                        {faq.a}
                      </p>
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
