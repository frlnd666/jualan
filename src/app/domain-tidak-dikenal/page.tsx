// Halaman "domain belum terhubung" (Fase 5).
// Ditampilkan bila seseorang membuka domain custom yang menunjuk ke
// server ini tapi belum terdaftar/terverifikasi di toko mana pun.
// Bukan 404 biasa — menjelaskan apa yang terjadi dan ke mana pergi.
import Link from 'next/link'

export default async function DomainTidakDikenalPage({
  searchParams,
}: {
  searchParams: Promise<{ host?: string }>
}) {
  const { host } = await searchParams
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f1ea] px-4 py-10 text-zinc-900">
      <div className="w-full max-w-md rounded-[32px] border border-black/5 bg-white p-8 text-center shadow-[0_12px_30px_rgba(33,24,20,0.06)]">
        <p className="text-4xl">🌐</p>
        <h1 className="mt-4 text-xl font-bold tracking-tight">
          Domain ini belum terhubung ke toko mana pun
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          {host ? (
            <>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">
                {host}
              </code>{' '}
            </>
          ) : null}
          Alamat ini mengarah ke CUAN, tapi belum ada toko yang memakai
          domain ini. Pemilik toko bisa menghubungkannya di Dashboard →
          Domain setelah DNS-nya benar.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-[#0b6b4a] px-5 py-3 text-sm font-bold text-white"
        >
          Ke halaman utama CUAN
        </Link>
      </div>
    </div>
  )
}
