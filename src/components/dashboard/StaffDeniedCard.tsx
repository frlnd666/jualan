// Kartu penolakan untuk staff yang membuka halaman owner-only
// (pengaturan, langganan, pengiriman, chat). Dipakai halaman server
// maupun client — penegakan sesungguhnya tetap di server action/RLS,
// kartu ini hanya penjelasannya.
export default function StaffDeniedCard({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-xl space-y-4 pt-6">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
        {title}
      </h1>
      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-sm)]">
        <p className="text-base font-bold text-[var(--text)]">
          Halaman ini hanya untuk pemilik toko
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          Staff hanya bisa mengelola produk dan pesanan. Pengaturan toko,
          langganan, pembayaran, pengiriman, dan chat hanya bisa dibuka
          pemilik toko.
        </p>
      </section>
    </div>
  )
}
