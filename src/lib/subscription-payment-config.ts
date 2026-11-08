// Detail pembayaran langganan MANUAL ke platform (Fase 1, Bab 6).
//
// Langganan dibayar penjual langsung ke PLATFORM (bukan ke toko) —
// berbeda dengan pembayaran order yang masuk ke rekening toko.
// Form upgrade di /dashboard/subscription menampilkan detail di bawah
// ini supaya penjual tahu ke mana harus membayar sebelum upload bukti.
//
// SUMBER NILAI: environment variable (diatur di Vercel Dashboard →
// Project Settings → Environment Variables), BUKAN ditulis langsung
// di file ini — supaya nomor rekening tidak masuk ke riwayat git.
//   NEXT_PUBLIC_PLATFORM_BANK_NAME     (mis. BCA)
//   NEXT_PUBLIC_PLATFORM_BANK_ACCOUNT  (nomor rekening platform)
//   NEXT_PUBLIC_PLATFORM_BANK_HOLDER   (nama pemilik rekening)
//   NEXT_PUBLIC_PLATFORM_QRIS_URL      (URL gambar QRIS platform)
// Selama masih kosong, halaman Langganan menampilkan pesan "detail
// pembayaran belum diisi, hubungi admin" dan pengajuan tetap bisa
// dikirim (bukti tetap diverifikasi admin) — tapi penjual tidak tahu
// harus bayar ke mana, jadi JANGAN anggap alur ini selesai sebelum
// detail diisi.
export const PLATFORM_PAYMENT_DETAILS = {
  bankName: process.env.NEXT_PUBLIC_PLATFORM_BANK_NAME ?? '',
  accountNumber: process.env.NEXT_PUBLIC_PLATFORM_BANK_ACCOUNT ?? '',
  accountHolder: process.env.NEXT_PUBLIC_PLATFORM_BANK_HOLDER ?? '',
  qrisImageUrl: process.env.NEXT_PUBLIC_PLATFORM_QRIS_URL ?? '',
}

export function hasPlatformPaymentDetails() {
  return Boolean(
    PLATFORM_PAYMENT_DETAILS.accountNumber ||
      PLATFORM_PAYMENT_DETAILS.qrisImageUrl
  )
}
