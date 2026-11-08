// Ongkir berbasis berat (Fase 3, rencana SaaS Bab 5 poin 6).
// Fungsi MURNI (tidak menyentuh database) supaya gampang dites dan
// dipakai di dua sisi: server (checkout — harga yang mengikat) dan
// client (halaman checkout — preview harga sebelum submit).

/** Berat default bila produk belum diisi weight_gram (gram). */
export const DEFAULT_WEIGHT_GRAM = 500

/** 1 kg = 1000 gram — pembulatan ke atas per kg tambahan. */
export const GRAMS_PER_KG = 1000

export interface ShippingRate {
  /** Harga dasar — sudah termasuk baseWeightGram pertama. */
  basePrice: number
  /** Ongkir tambahan per kg (atau bagiannya) di atas berat dasar. */
  perKgPrice: number
  /** Berat (gram) yang sudah termasuk di harga dasar. */
  baseWeightGram: number
}

export interface WeightedLine {
  /** Berat per unit (gram); null/undefined = DEFAULT_WEIGHT_GRAM. */
  weightGram?: number | null
  qty: number
}

/** Total berat keranjang (gram). Item tanpa berat memakai default. */
export function totalWeightGrams(lines: WeightedLine[]): number {
  return lines.reduce((sum, line) => {
    const qty = Math.max(0, Math.floor(Number(line.qty) || 0))
    const weight = Number(line.weightGram)
    const perUnit =
      Number.isFinite(weight) && weight > 0 ? weight : DEFAULT_WEIGHT_GRAM
    return sum + perUnit * qty
  }, 0)
}

/**
 * Ongkir untuk berat total tertentu.
 * - Berat <= berat dasar: harga dasar saja.
 * - Di atas itu: + perKgPrice untuk tiap kg tambahan (dibulatkan ke atas).
 * Nilai negatif / tidak valid dikunci ke 0 — ongkir tidak boleh minus.
 */
export function calcShippingCost(rate: ShippingRate, totalWeightGram: number): number {
  const base = Math.max(0, Number(rate.basePrice) || 0)
  const perKg = Math.max(0, Number(rate.perKgPrice) || 0)
  const baseWeight = Math.max(1, Number(rate.baseWeightGram) || GRAMS_PER_KG)
  const weight = Math.max(0, Number(totalWeightGram) || 0)

  if (weight <= baseWeight || perKg === 0) return base
  const extraKg = Math.ceil((weight - baseWeight) / GRAMS_PER_KG)
  return base + extraKg * perKg
}

/** "500 g" / "1,2 kg" — untuk tampilan ringkasan checkout. */
export function formatWeight(totalWeightGram: number): string {
  const weight = Math.max(0, Number(totalWeightGram) || 0)
  if (weight < GRAMS_PER_KG) return `${weight.toLocaleString('id-ID')} g`
  const kg = weight / GRAMS_PER_KG
  return `${kg.toLocaleString('id-ID', { maximumFractionDigits: 1 })} kg`
}
