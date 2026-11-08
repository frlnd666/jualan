// Voucher / diskon per toko (Fase 3, rencana SaaS Bab 3 + Bab 5).
// Fungsi MURNI (tidak menyentuh database) supaya gampang dites.
// Penegakan yang mengikat tetap di server action:
// - hanya pemilik toko Silver/Gold yang boleh MEMBUAT voucher
//   (TIER_LIMITS free.vouchers = false — lihat subscription-tiers.ts);
// - validasi saat checkout memakai fungsi di sini + hitung pemakaian
//   dari database (used_count), supaya tidak ada diskon yang dipercaya
//   dari input browser.

export type VoucherDiscountType = 'percent' | 'fixed'

export interface VoucherLike {
  id: string
  store_id: string
  code: string
  discount_type: VoucherDiscountType
  /** persen 1–100, atau nominal rupiah untuk 'fixed'. */
  discount_value: number
  min_order: number
  max_uses: number | null
  used_count: number
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
}

/** Kode voucher selalu disimpan & dibandingkan huruf besar, tanpa spasi. */
export function normalizeVoucherCode(code: string): string {
  return code.trim().toUpperCase()
}

/**
 * Besaran diskon dari subtotal (SEBELUM ongkir).
 * - persen: dibulatkan ke bawah, tidak boleh melebihi subtotal.
 * - nominal: tidak boleh melebihi subtotal.
 */
export function calcDiscount(
  type: VoucherDiscountType,
  value: number,
  subtotal: number
): number {
  const safeSubtotal = Math.max(0, Math.floor(Number(subtotal) || 0))
  if (safeSubtotal <= 0) return 0
  if (type === 'percent') {
    const pct = Math.min(100, Math.max(0, Number(value) || 0))
    return Math.min(safeSubtotal, Math.floor((safeSubtotal * pct) / 100))
  }
  return Math.min(safeSubtotal, Math.max(0, Math.floor(Number(value) || 0)))
}

export type VoucherValidation =
  | { ok: true; discount: number }
  | { ok: false; error: string }

/**
 * Validasi voucher terhadap subtotal pada saat `now`.
 * Urutan cek: aktif → masa berlaku → minimum order → kuota pakai →
 * besaran diskon. Mengembalikan pesan error Bahasa Indonesia yang bisa
 * langsung ditampilkan ke pembeli.
 */
export function validateVoucher(
  voucher: VoucherLike,
  subtotal: number,
  now: Date = new Date()
): VoucherValidation {
  if (!voucher.is_active) {
    return { ok: false, error: 'Voucher ini sudah tidak aktif.' }
  }
  if (voucher.starts_at && now < new Date(voucher.starts_at)) {
    return { ok: false, error: 'Voucher ini belum berlaku.' }
  }
  if (voucher.ends_at && now > new Date(voucher.ends_at)) {
    return { ok: false, error: 'Voucher ini sudah kedaluwarsa.' }
  }
  if (voucher.max_uses !== null && voucher.used_count >= voucher.max_uses) {
    return { ok: false, error: 'Kuota pemakaian voucher ini sudah habis.' }
  }
  const minOrder = Math.max(0, Number(voucher.min_order) || 0)
  if (subtotal < minOrder) {
    return {
      ok: false,
      error: `Minimum belanja untuk voucher ini Rp ${minOrder.toLocaleString('id-ID')}.`,
    }
  }
  const discount = calcDiscount(voucher.discount_type, voucher.discount_value, subtotal)
  if (discount <= 0) {
    return { ok: false, error: 'Voucher ini tidak memberi diskon untuk pesanan ini.' }
  }
  return { ok: true, discount }
}

/** Apakah toko boleh membuat voucher (tier Silver/Gold & tidak terkunci). */
export function canCreateVoucher(
  vouchersAllowed: boolean,
  premiumLocked: boolean
): boolean {
  return vouchersAllowed && !premiumLocked
}
