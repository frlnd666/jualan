// Aksi wizard onboarding toko (Fase 2, 'use server').
//
// Alur 5 langkah setelah register: info toko → pembayaran toko →
// pengiriman → produk pertama → selesai. Progress tersimpan di
// stores.onboarding_step (0 = belum mulai, 5 = selesai) sehingga
// wizard bisa ditinggal dan dilanjutkan lagi.
//
// Hanya pemilik toko yang bisa menjalankan wizard (staff tidak punya
// toko; admin platform tidak masuk wizard).
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ensureStoreSubscription } from '@/lib/actions/subscriptions'

export type OnboardingStore = {
  id: string
  name: string
  slug: string
  description: string | null
  whatsapp: string | null
  city: string | null
  address: string | null
  bank_name: string | null
  bank_account_name: string | null
  bank_account_number: string | null
  qris_image_url: string | null
  cod_enabled: boolean | null
  origin: string | null
  onboarding_step: number
}

async function requireOwnerStore(): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; userId: string; store: OnboardingStore | null }
  | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  // Admin platform tidak memakai wizard toko — jangan biarkan admin
  // membuat toko lewat sini (akan mengubahnya jadi seller).
  const { data: roleRow } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if ((roleRow as { role?: string } | null)?.role === 'admin') {
    return { error: 'Admin platform tidak memakai wizard toko.' }
  }

  const { data: store } = await supabase
    .from('stores')
    .select(
      'id, name, slug, description, whatsapp, city, address, bank_name, bank_account_name, bank_account_number, qris_image_url, cod_enabled, origin, onboarding_step'
    )
    .eq('owner_id', user.id)
    .maybeSingle()
  return {
    supabase,
    userId: user.id,
    store: (store as OnboardingStore | null) ?? null,
  }
}

export async function getOnboardingStateAction(): Promise<
  { store: OnboardingStore | null } | { error: string }
> {
  const owner = await requireOwnerStore()
  if ('error' in owner) return { error: owner.error }
  return { store: owner.store }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// Langkah 1 — info toko (buat toko bila belum ada, atau perbarui).
export async function saveOnboardingStoreAction(input: {
  name: string
  slug: string
  description: string
  whatsapp: string
  city: string
  address: string
}): Promise<{ success: true; storeId: string } | { error: string }> {
  const owner = await requireOwnerStore()
  if ('error' in owner) return { error: owner.error }
  const { supabase, userId } = owner

  const name = input.name.trim()
  const slug = slugify(input.slug || input.name)
  if (!name) return { error: 'Nama toko wajib diisi.' }
  if (!slug) return { error: 'Slug toko wajib diisi.' }

  const payload = {
    name,
    slug,
    description: input.description.trim() || null,
    whatsapp: input.whatsapp.trim() || null,
    city: input.city.trim() || null,
    address: input.address.trim() || null,
    onboarding_step: 1,
  }

  if (owner.store) {
    const { error } = await supabase
      .from('stores')
      .update(payload)
      .eq('id', owner.store.id)
    if (error) {
      if (error.message?.toLowerCase().includes('duplicate')) {
        return { error: 'Slug toko sudah dipakai. Gunakan slug lain.' }
      }
      return { error: 'Gagal menyimpan info toko.' }
    }
    return { success: true, storeId: owner.store.id }
  }

  const { data, error } = await supabase
    .from('stores')
    .insert({ ...payload, owner_id: userId })
    .select('id')
    .single()
  if (error || !data) {
    if (error?.message?.toLowerCase().includes('duplicate')) {
      return { error: 'Slug toko sudah dipakai. Gunakan slug lain.' }
    }
    return { error: 'Gagal membuat toko.' }
  }
  // Toko baru langsung punya langganan Free/ACTIVE (sama seperti
  // halaman settings) + peran pemilik naik jadi seller.
  await ensureStoreSubscription(data.id as string, 'free')
  revalidatePath('/dashboard')
  return { success: true, storeId: data.id as string }
}

// Langkah 2 — pembayaran toko (rekening / QRIS / COD). Ditulis ke
// kolom bank_* + cod_enabled; kolom legacy payment_* tidak disentuh.
export async function saveOnboardingPaymentAction(input: {
  bankName: string
  bankAccountName: string
  bankAccountNumber: string
  qrisImageUrl: string
  codEnabled: boolean
}): Promise<{ success: true } | { error: string }> {
  const owner = await requireOwnerStore()
  if ('error' in owner) return { error: owner.error }
  if (!owner.store) return { error: 'Buat info toko dulu (langkah 1).' }

  const { error } = await owner.supabase
    .from('stores')
    .update({
      bank_name: input.bankName.trim() || null,
      bank_account_name: input.bankAccountName.trim() || null,
      bank_account_number: input.bankAccountNumber.trim() || null,
      qris_image_url: input.qrisImageUrl.trim() || null,
      cod_enabled: input.codEnabled,
      onboarding_step: 2,
    })
    .eq('id', owner.store.id)
  if (error) return { error: 'Gagal menyimpan pembayaran toko.' }
  return { success: true }
}

// Langkah 3 — pengiriman: kota asal + metode pengiriman pertama.
// Metode boleh kosong (bisa ditambah nanti di Pengiriman) — yang
// wajib hanya kota asal.
export async function saveOnboardingShippingAction(input: {
  origin: string
  methods: Array<{ name: string; price: number; estimatedDays: string }>
}): Promise<{ success: true } | { error: string }> {
  const owner = await requireOwnerStore()
  if ('error' in owner) return { error: owner.error }
  if (!owner.store) return { error: 'Buat info toko dulu (langkah 1).' }

  const origin = input.origin.trim()
  if (!origin) return { error: 'Kota asal pengiriman wajib diisi.' }

  const { error } = await owner.supabase
    .from('stores')
    .update({ origin, onboarding_step: 3 })
    .eq('id', owner.store.id)
  if (error) return { error: 'Gagal menyimpan pengiriman.' }

  const validMethods = input.methods
    .map((m) => ({
      name: m.name.trim(),
      price: Math.max(0, Number(m.price) || 0),
      estimated_days: m.estimatedDays.trim() || null,
    }))
    .filter((m) => m.name)
  if (validMethods.length > 0) {
    const { error: insertError } = await owner.supabase
      .from('shipping_methods')
      .insert(
        validMethods.map((m) => ({
          store_id: owner.store!.id,
          name: m.name,
          price: m.price,
          estimated_days: m.estimated_days,
          is_active: true,
        }))
      )
    if (insertError) return { error: 'Kota asal tersimpan, tapi metode pengiriman gagal disimpan.' }
  }
  return { success: true }
}

// Langkah 4 selesai — produk pertama dibuat lewat createProductAction;
// setelah itu tandai langkah 4.
export async function markOnboardingProductDoneAction(): Promise<
  { success: true } | { error: string }
> {
  const owner = await requireOwnerStore()
  if ('error' in owner) return { error: owner.error }
  if (!owner.store) return { error: 'Buat info toko dulu (langkah 1).' }
  const { error } = await owner.supabase
    .from('stores')
    .update({ onboarding_step: 4 })
    .eq('id', owner.store.id)
  if (error) return { error: 'Gagal menyimpan progress.' }
  return { success: true }
}

// Langkah 5 — selesai: tandai wizard rampung.
export async function finishOnboardingAction(): Promise<
  { success: true } | { error: string }
> {
  const owner = await requireOwnerStore()
  if ('error' in owner) return { error: owner.error }
  if (!owner.store) return { error: 'Buat info toko dulu (langkah 1).' }
  const { error } = await owner.supabase
    .from('stores')
    .update({ onboarding_step: 5 })
    .eq('id', owner.store.id)
  if (error) return { error: 'Gagal menyelesaikan onboarding.' }
  revalidatePath('/dashboard')
  return { success: true }
}
