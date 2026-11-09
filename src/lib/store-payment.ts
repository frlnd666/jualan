// Validasi tujuan pembayaran toko (K-05) — logika murni, dites vitest.
//
// Aturan (disepakati):
// - Ketiga kolom rekening (nama bank, nomor rekening, nama pemilik) harus
//   diisi bersamaan atau dikosongkan bersamaan — jangan biarkan setengah
//   terisi, karena invoice hanya bisa menampilkan tujuan bayar yang lengkap.
// - Nomor rekening hanya boleh berisi angka, spasi, dan tanda hubung.
// - URL gambar QRIS, bila diisi, harus URL http(s) penuh — invoice
//   merendernya sebagai <img> absolut, URL relatif akan 404.
// - Semuanya boleh kosong (toko COD saja / QRIS dinamis saja).
// Wizard onboarding tidak memakai validator ini (tidak diubah di K-05).

export type StorePaymentInput = {
  bankName: string
  bankAccountName: string
  bankAccountNumber: string
  qrisImageUrl: string
  codEnabled: boolean
}

/** Kembalikan pesan error (Bahasa Indonesia), atau null bila valid. */
export function validateStorePayment(input: StorePaymentInput): string | null {
  const bankName = input.bankName.trim()
  const bankAccountName = input.bankAccountName.trim()
  const bankAccountNumber = input.bankAccountNumber.trim()
  const qrisImageUrl = input.qrisImageUrl.trim()

  const filledBankFields = [bankName, bankAccountName, bankAccountNumber].filter(
    (v) => v.length > 0
  ).length
  if (filledBankFields > 0 && filledBankFields < 3) {
    return 'Isi ketiga kolom rekening (nama bank, nomor rekening, nama pemilik rekening) atau kosongkan ketiganya.'
  }

  if (bankAccountNumber && !/^[0-9\s-]+$/.test(bankAccountNumber)) {
    return 'Nomor rekening hanya boleh berisi angka, spasi, dan tanda hubung (-).'
  }

  if (qrisImageUrl && !/^https?:\/\/.+/.test(qrisImageUrl)) {
    return 'URL gambar QRIS harus diawali http:// atau https://.'
  }

  return null
}
