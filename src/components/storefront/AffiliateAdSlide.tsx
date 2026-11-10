// Slide iklan afiliasi platform (Fase 4).
// Tampil di storefront toko paket FREE — 1 slide, berlabel "Iklan"
// (sesuai rencana SaaS Bab 3). Isinya house ad CUAN (buka toko sendiri)
// sampai ada inventaris iklan afiliasi; tautan ke halaman register.
// Silver/Gold TIDAK melihat slide ini (mereka pakai banner sendiri).
// Audit 2026-11-10 (U-2): seluruh warna sekarang token-driven supaya
// slide mengikuti tema toko (sebelumnya gradasi amber-zamrud + palet
// cokelat lama yang hardcode dan bentrok di tema Warm/Minimal).
import Link from 'next/link'

export default function AffiliateAdSlide() {
  return (
    <section
      aria-label="Iklan"
      className="relative overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--surface-soft)] p-5 shadow-[var(--shadow-sm)]"
    >
      <span className="absolute right-4 top-4 rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--primary)]">
        Iklan
      </span>
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
        Punya usaha sendiri?
      </p>
      <h2 className="mt-2 max-w-md text-lg font-bold leading-7 text-[var(--text)]">
        Buka tokomu sendiri di CUAN — gratis, tanpa ribet.
      </h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-[var(--text-muted)]">
        Buat etalase online, terima pesanan, dan atur pengiriman dari satu
        tempat.
      </p>
      <Link
        href="/register"
        className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)]"
      >
        Buat Toko Gratis
      </Link>
    </section>
  )
}
