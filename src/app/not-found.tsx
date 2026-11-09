// Halaman 404 bermerek (R-06, 2026-11-09). Dipakai semua notFound()
// di repo — sebelumnya memakai halaman 404 bawaan Next.js.
import Link from 'next/link'
import { SearchX } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="flex justify-center" aria-hidden>
        <SearchX className="h-10 w-10 text-[var(--text-muted)]" />
      </p>
      <h1 className="mt-4 text-xl font-bold text-[var(--text)]">
        Halaman tidak ditemukan
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
        Tautan yang kamu buka mungkin sudah dihapus, toko sudah tidak aktif,
        atau alamatnya salah ketik.
      </p>
      <div className="mt-6">
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-full bg-[var(--primary)] px-6 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition active:scale-[0.98]"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  )
}
