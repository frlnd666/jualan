// Slide iklan afiliasi platform (Fase 4).
// Tampil di storefront toko paket FREE — 1 slide, berlabel "Iklan"
// (sesuai rencana SaaS Bab 3). Isinya house ad CUAN (buka toko sendiri)
// sampai ada inventaris iklan afiliasi; tautan ke halaman register.
// Silver/Gold TIDAK melihat slide ini (mereka pakai banner sendiri).
import Link from 'next/link'

export default function AffiliateAdSlide() {
  return (
    <section
      aria-label="Iklan"
      className="relative overflow-hidden rounded-[28px] border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-emerald-50 p-5 shadow-[0_12px_30px_rgba(33,24,20,0.06)]"
    >
      <span className="absolute right-4 top-4 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-800">
        Iklan
      </span>
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8d7f73]">
        Punya usaha sendiri?
      </p>
      <h2 className="mt-2 max-w-md text-lg font-bold leading-7 text-[#241b17]">
        Buka tokomu sendiri di CUAN — gratis, tanpa ribet.
      </h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-[#7a6b5f]">
        Buat etalase online, terima pesanan, dan atur pengiriman dari satu
        tempat.
      </p>
      <Link
        href="/register"
        className="mt-4 inline-flex items-center justify-center rounded-full bg-[#0b6b4a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#095c40]"
      >
        Buat Toko Gratis
      </Link>
    </section>
  )
}
