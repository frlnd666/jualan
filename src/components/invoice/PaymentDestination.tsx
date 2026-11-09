// Blok "Tujuan pembayaran" di halaman invoice publik (K-05).
//
// Server Component: dirender di dalam langkah 1 ("Bayar ...") saat
// invoice masih menunggu pembayaran manual. Setiap kolom yang terisi
// ditampilkan bersama tombol salin; kolom yang kosong dilewati (data
// lama bisa setengah terisi — wizard dulu tidak memvalidasi trio
// rekening). Bila toko tidak mengisi apa pun, tampil pesan singkat
// agar pembeli tahu harus meminta tujuan bayar lewat chat.
import CopyTextButton from '@/components/order/CopyTextButton'

export type PaymentDestinationProps = {
  bankName: string | null
  bankAccountName: string | null
  bankAccountNumber: string | null
  qrisImageUrl: string | null
}

function DestinationRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {label}
        </p>
        <p
          className={`mt-0.5 break-words text-sm font-semibold text-neutral-900 ${
            mono ? 'font-mono' : ''
          }`}
        >
          {value}
        </p>
      </div>
      <CopyTextButton text={value} />
    </div>
  )
}

export default function PaymentDestination({
  bankName,
  bankAccountName,
  bankAccountNumber,
  qrisImageUrl,
}: PaymentDestinationProps) {
  const bank = bankName?.trim() || null
  const accountName = bankAccountName?.trim() || null
  const accountNumber = bankAccountNumber?.trim() || null
  const qris = qrisImageUrl?.trim() || null

  if (!bank && !accountName && !accountNumber && !qris) {
    return (
      <p className="mt-2 text-sm leading-6 text-amber-800">
        Penjual belum mengisi tujuan pembayaran — hubungi penjual lewat
        tombol Chat penjual untuk meminta nomor rekening / kode QRIS.
      </p>
    )
  }

  return (
    <div className="mt-3 space-y-4 rounded-2xl border border-amber-200 bg-white p-4">
      {bank ? <DestinationRow label="Bank" value={bank} /> : null}
      {accountNumber ? (
        <DestinationRow label="Nomor rekening" value={accountNumber} mono />
      ) : null}
      {accountName ? (
        <DestinationRow label="Nama pemilik rekening" value={accountName} />
      ) : null}
      {qris ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            QRIS toko
          </p>
          {/* URL gambar dari penjual (bisa host mana pun) — <img> biasa,
              bukan next/image yang butuh remotePatterns per host. */}
          <img
            src={qris}
            alt="Kode QRIS toko"
            className="mt-2 w-48 rounded-xl border border-neutral-200"
          />
        </div>
      ) : null}
      <p className="text-xs leading-5 text-neutral-500">
        Bayar persis sampai digit terakhir agar mudah diverifikasi.
      </p>
    </div>
  )
}
