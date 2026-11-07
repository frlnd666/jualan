/**
 * Ditampilkan di halaman invoice/tracking publik bila invoice tidak bisa
 * dibaca KARENA konfigurasi server belum lengkap (SUPABASE_SERVICE_ROLE_KEY
 * belum terpasang), supaya kegagalan konfigurasi tidak menyamar sebagai
 * "404 Not Found" yang membingungkan pembeli dan pemilik toko.
 */
export default function PublicConfigNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-7 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-xl">
          ⚙️
        </div>
        <h1 className="mt-4 text-lg font-bold text-neutral-900">
          Halaman ini belum bisa dibuka
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Konfigurasi server toko belum lengkap, jadi data pesanan belum bisa
          ditampilkan. Bagi pemilik toko: pastikan variabel{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs font-semibold text-neutral-800">
            SUPABASE_SERVICE_ROLE_KEY
          </code>{' '}
          sudah terpasang di Vercel (Production), lalu redeploy. Bagi pembeli:
          pesananmu tetap tercatat — hubungi penjual bila perlu.
        </p>
      </div>
    </div>
  )
}
