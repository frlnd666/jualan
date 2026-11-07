"use client";

import { motion } from "framer-motion";
import {
  ListChecks,
  MessagesSquare,
  Palette,
  ReceiptText,
  ShoppingBag,
  Truck,
} from "lucide-react";

const features = [
  {
    icon: ShoppingBag,
    title: "Katalog & checkout 3 langkah",
    desc: "Pembeli memilih produk, mengisi alamat, memilih pengiriman dan pembayaran — selesai. Harga dan stok selalu dihitung ulang dari data toko, bukan dari browser pembeli.",
  },
  {
    icon: ReceiptText,
    title: "Invoice & bukti transfer",
    desc: "Setiap pesanan punya halaman invoice sendiri: panduan pembayaran, formulir upload bukti transfer, dan garis waktu status yang selalu bisa dipantau pembeli.",
  },
  {
    icon: ListChecks,
    title: "Antrean “Perlu tindakan”",
    desc: "Dashboard penjual membuka dengan daftar yang harus dikerjakan: bukti transfer menunggu verifikasi dan pesanan yang perlu dikirim. Konfirmasi pembayaran langsung dari detail pesanan.",
  },
  {
    icon: Truck,
    title: "Pengiriman & nomor resi",
    desc: "Atur metode dan tarif pengiriman tokomu sendiri. Setelah paket dikirim, input nomor resi dan pembeli melihatnya langsung di halaman invoice mereka.",
  },
  {
    icon: MessagesSquare,
    title: "Chat dengan pembeli",
    desc: "Pembeli bisa mengobrol dari halaman toko dan kamu membalas dari dashboard. Tombol WhatsApp juga tersedia di halaman invoice untuk hal yang mendesak.",
  },
  {
    icon: Palette,
    title: "Tiga tema toko",
    desc: "Pilih tampilan Default (Indigo), Warm (Amber), atau Minimal (Slate), lengkap dengan logo dan banner tokomu. Ganti kapan saja tanpa mengubah isi katalog.",
  },
];

export function FeatureGrid() {
  return (
    <section id="fitur" className="scroll-mt-20 border-y border-[var(--line)] bg-[var(--surface)] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--primary)]">
            Fitur
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
            Semua yang dibutuhkan untuk jualan harian
          </h2>
          <p className="mt-4 text-base leading-7 text-[var(--text-muted)]">
            Bukan daftar janji — semua fitur di bawah ini sudah berjalan di
            toko contoh Kopi Sore dan bisa langsung kamu pakai.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature, index) => (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-6"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-base font-semibold text-[var(--text)]">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {feature.desc}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
