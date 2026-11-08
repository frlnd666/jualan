// Flash sale per produk (Fase 4, rencana SaaS Bab 3 + Bab 7).
// Fungsi MURNI (tidak menyentuh database) supaya gampang dites.
// Penegakan yang mengikat tetap di server action:
// - hanya pemilik toko Silver/Gold yang boleh MEMBUAT flash sale
//   (TIER_LIMITS silver/gold.flashSales = true; Free = false);
// - harga promo yang dipakai checkout dihitung ulang server-side
//   (createOrderAction) dari tabel flash_sales — tidak ada harga
//   promo yang dipercaya dari input browser.

export interface FlashSaleLike {
  id: string
  store_id: string
  product_id: string
  promo_price: number
  starts_at: string
  ends_at: string
  is_active: boolean
}

/** Apakah flash sale sedang berjalan pada saat `now`. */
export function isFlashSaleActive(
  sale: FlashSaleLike,
  now: Date = new Date()
): boolean {
  if (!sale.is_active) return false
  const start = new Date(sale.starts_at).getTime()
  const end = new Date(sale.ends_at).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return false
  const t = now.getTime()
  return t >= start && t <= end
}

/** Flash sale yang sedang aktif untuk sebuah produk (paling akhir dibuat). */
export function activeFlashSaleForProduct(
  sales: FlashSaleLike[],
  productId: string,
  now: Date = new Date()
): FlashSaleLike | null {
  const active = sales
    .filter((s) => s.product_id === productId && isFlashSaleActive(s, now))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
  return active[0] ?? null
}

/**
 * Harga yang berlaku untuk produk: harga promo bila ada flash sale
 * aktif DAN harganya lebih murah dari harga normal; selain itu harga
 * normal. (Promo yang harganya >= harga normal tidak pernah dipakai
 * — cegah "diskon" yang menaikkan harga.)
 */
export function effectivePrice(
  normalPrice: number,
  sale: FlashSaleLike | null,
  now: Date = new Date()
): number {
  const base = Math.max(0, Math.floor(Number(normalPrice) || 0))
  if (!sale || !isFlashSaleActive(sale, now)) return base
  const promo = Math.max(0, Math.floor(Number(sale.promo_price) || 0))
  if (promo <= 0 || promo >= base) return base
  return promo
}

/** Persen diskon (dibulatkan) dari harga normal ke harga promo. */
export function discountPercent(normalPrice: number, promoPrice: number): number {
  const base = Math.max(0, Number(normalPrice) || 0)
  const promo = Math.max(0, Number(promoPrice) || 0)
  if (base <= 0 || promo >= base) return 0
  return Math.round(((base - promo) / base) * 100)
}

/** Apakah toko boleh membuat flash sale (tier Silver/Gold & tidak terkunci). */
export function canCreateFlashSale(
  flashSalesAllowed: boolean,
  premiumLocked: boolean
): boolean {
  return flashSalesAllowed && !premiumLocked
}

/** Sisa waktu flash sale dalam milidetik (0 bila sudah berakhir). */
export function flashSaleRemainingMs(
  sale: FlashSaleLike,
  now: Date = new Date()
): number {
  const end = new Date(sale.ends_at).getTime()
  if (Number.isNaN(end)) return 0
  return Math.max(0, end - now.getTime())
}

/** Format sisa waktu "2j 15m" / "45m" / "30d" untuk badge storefront. */
export function formatFlashRemaining(ms: number): string {
  if (ms <= 0) return 'Berakhir'
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes}m lagi`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) {
    const rest = minutes % 60
    return rest > 0 ? `${hours}j ${rest}m lagi` : `${hours}j lagi`
  }
  const days = Math.floor(hours / 24)
  return `${days} hari lagi`
}
