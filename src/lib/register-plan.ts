// Paket yang dipilih di landing saat register (Fase 1).
// Disimpan di localStorage karena pendaftaran bisa melewati verifikasi
// email — parameter ?plan= di URL akan hilang saat user kembali dari
// inbox. Dibaca sekali oleh Pengaturan Toko saat toko pertama dibuat.
export const REGISTER_PLAN_KEY = 'cuan_plan'

export type RegisterPlan = 'free' | 'silver-trial' | 'gold'

export function readStoredPlan(): RegisterPlan {
  try {
    const plan = window.localStorage.getItem(REGISTER_PLAN_KEY)
    if (plan === 'silver-trial' || plan === 'gold') return plan
  } catch {}
  return 'free'
}

export function clearStoredPlan() {
  try {
    window.localStorage.removeItem(REGISTER_PLAN_KEY)
  } catch {}
}
