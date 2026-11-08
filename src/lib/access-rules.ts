// Aturan akses Fase 2 — fungsi MURNI (tidak menyentuh database) supaya
// gampang dites. Penegakan yang mengikat tetap di server action / RLS;
// file ini hanya satu sumber kebenaran untuk keputusan "boleh atau tidak".

export type DashboardSection =
  | 'beranda'
  | 'produk'
  | 'pesanan'
  | 'chat'
  | 'pengiriman'
  | 'langganan'
  | 'pengaturan'
  | 'staff'
  | 'admin'

export type DashboardRole = 'owner' | 'staff' | 'admin' | 'buyer' | 'none'

/** Bagian dashboard yang boleh dibuka staff (rencana SaaS poin 8):
 *  kelola produk + pesanan saja. Pengaturan toko, langganan,
 *  pengiriman, chat, dan kelola staff hanya pemilik. */
export const STAFF_ALLOWED_SECTIONS: DashboardSection[] = [
  'beranda',
  'produk',
  'pesanan',
]

export function canStaffAccess(section: DashboardSection): boolean {
  return STAFF_ALLOWED_SECTIONS.includes(section)
}

/** Apakah peran ini boleh membuka bagian dashboard tersebut. Admin
 *  memakai halaman admin sendiri (/dashboard/admin), bukan dashboard toko. */
export function canAccessSection(
  role: DashboardRole,
  section: DashboardSection
): boolean {
  if (role === 'owner') return true
  if (role === 'staff') return canStaffAccess(section)
  return false
}

/** Sisa slot staff untuk toko (batas mengikuti tier — Bab 3). */
export function staffSlotsLeft(
  currentStaffCount: number,
  maxStaff: number
): number {
  return Math.max(0, maxStaff - Math.max(0, currentStaffCount))
}

export function canAddStaff(currentStaffCount: number, maxStaff: number): boolean {
  return staffSlotsLeft(currentStaffCount, maxStaff) > 0
}

/** Langkah wizard onboarding toko (0 = selesai, 1..5 = berjalan). */
export const ONBOARDING_TOTAL_STEPS = 5

export const ONBOARDING_STEP_LABELS: Record<number, string> = {
  1: 'Info toko',
  2: 'Pembayaran toko',
  3: 'Pengiriman',
  4: 'Produk pertama',
  5: 'Selesai',
}

export function isValidOnboardingStep(step: number): boolean {
  return Number.isInteger(step) && step >= 0 && step <= ONBOARDING_TOTAL_STEPS
}

/** Langkah wizard berikutnya setelah langkah `current` selesai.
 *  Langkah 0 (selesai) tetap 0; langkah di luar rentang dianggap 1. */
export function nextOnboardingStep(current: number): number {
  if (!isValidOnboardingStep(current) || current === 0) return 0
  return current >= ONBOARDING_TOTAL_STEPS ? 0 : current + 1
}

export type CartLine = { productId: string; qty: number }

/**
 * Gabung keranjang saat pembeli login (dipakai BuyerCartSync):
 * - keranjang lokal kosong → pakai keranjang tersimpan di akun;
 * - keranjang lokal ada isinya → lokal menang (interaksi terbaru),
 *   lalu didorong ke server; keranjang server yang lama dibuang.
 * Mengembalikan item hasil gabung + dari mana asalnya.
 */
export function resolveCartOnLogin(
  localItems: CartLine[],
  serverItems: CartLine[]
): { items: CartLine[]; source: 'local' | 'server' | 'empty' } {
  if (localItems.length > 0) return { items: localItems, source: 'local' }
  if (serverItems.length > 0) return { items: serverItems, source: 'server' }
  return { items: [], source: 'empty' }
}

/** Validasi alamat pembeli — mengembalikan pesan error atau null. */
export function validateBuyerAddress(input: {
  label?: string
  recipientName?: string
  phone?: string
  address?: string
  province?: string
  city?: string
  postalCode?: string
}): string | null {
  if (!input.recipientName?.trim()) return 'Nama penerima wajib diisi.'
  if (!input.phone?.trim()) return 'Nomor HP penerima wajib diisi.'
  if (!input.address?.trim()) return 'Alamat lengkap wajib diisi.'
  if (!input.province?.trim()) return 'Provinsi wajib diisi.'
  if (!input.city?.trim()) return 'Kota wajib diisi.'
  if (!input.postalCode?.trim()) return 'Kode pos wajib diisi.'
  return null
}