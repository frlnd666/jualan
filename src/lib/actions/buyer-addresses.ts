// Server action buku alamat pembeli (Fase 2).
// Semua akses lewat client user + RLS (buyer_addresses hanya milik
// pembeli yang bersangkutan) — tidak ada service_role di sini.
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { validateBuyerAddress } from '@/lib/access-rules'

export type BuyerAddress = {
  id: string
  label: string
  recipient_name: string
  phone: string
  address: string
  province: string
  city: string
  postal_code: string
  is_default: boolean
  created_at: string
}

export type BuyerAddressInput = {
  label: string
  recipientName: string
  phone: string
  address: string
  province: string
  city: string
  postalCode: string
  isDefault: boolean
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return { supabase, user }
}

function toRow(input: BuyerAddressInput) {
  return {
    label: input.label.trim() || 'Rumah',
    recipient_name: input.recipientName.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    province: input.province.trim(),
    city: input.city.trim(),
    postal_code: input.postalCode.trim(),
    is_default: input.isDefault,
  }
}

export async function listBuyerAddressesAction(): Promise<BuyerAddress[]> {
  const auth = await requireUser()
  if (!auth) return []
  const { supabase, user } = auth
  const { data } = await supabase
    .from('buyer_addresses')
    .select('id, label, recipient_name, phone, address, province, city, postal_code, is_default, created_at')
    .eq('buyer_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
  return ((data ?? []) as BuyerAddress[]).map((a) => ({
    ...a,
    is_default: Boolean(a.is_default),
  }))
}

export async function addBuyerAddressAction(
  input: BuyerAddressInput
): Promise<{ success: true } | { error: string }> {
  const validationError = validateBuyerAddress(input)
  if (validationError) return { error: validationError }
  const auth = await requireUser()
  if (!auth) return { error: 'Kamu harus login.' }
  const { supabase, user } = auth

  const { count } = await supabase
    .from('buyer_addresses')
    .select('id', { count: 'exact', head: true })
    .eq('buyer_id', user.id)
  const makeDefault = input.isDefault || (count ?? 0) === 0

  if (makeDefault) {
    await supabase
      .from('buyer_addresses')
      .update({ is_default: false })
      .eq('buyer_id', user.id)
  }

  const { error } = await supabase.from('buyer_addresses').insert({
    buyer_id: user.id,
    ...toRow(input),
    is_default: makeDefault,
  })
  if (error) return { error: 'Gagal menyimpan alamat.' }
  revalidatePath('/akun/alamat')
  return { success: true }
}

export async function updateBuyerAddressAction(
  id: string,
  input: BuyerAddressInput
): Promise<{ success: true } | { error: string }> {
  const validationError = validateBuyerAddress(input)
  if (validationError) return { error: validationError }
  const auth = await requireUser()
  if (!auth) return { error: 'Kamu harus login.' }
  const { supabase, user } = auth

  if (input.isDefault) {
    await supabase
      .from('buyer_addresses')
      .update({ is_default: false })
      .eq('buyer_id', user.id)
      .neq('id', id)
  }

  const { error } = await supabase
    .from('buyer_addresses')
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('buyer_id', user.id)
  if (error) return { error: 'Gagal mengubah alamat.' }
  revalidatePath('/akun/alamat')
  return { success: true }
}

export async function deleteBuyerAddressAction(
  id: string
): Promise<{ success: true } | { error: string }> {
  const auth = await requireUser()
  if (!auth) return { error: 'Kamu harus login.' }
  const { supabase, user } = auth

  const { data: target } = await supabase
    .from('buyer_addresses')
    .select('is_default')
    .eq('id', id)
    .eq('buyer_id', user.id)
    .maybeSingle()
  if (!target) return { error: 'Alamat tidak ditemukan.' }

  const { error } = await supabase
    .from('buyer_addresses')
    .delete()
    .eq('id', id)
    .eq('buyer_id', user.id)
  if (error) return { error: 'Gagal menghapus alamat.' }

  // Bila alamat default dihapus dan masih ada alamat lain, jadikan
  // alamat tertua sebagai default baru supaya checkout tetap punya
  // pilihan utama.
  if ((target as { is_default: boolean }).is_default) {
    const { data: remaining } = await supabase
      .from('buyer_addresses')
      .select('id')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
    if (remaining && remaining.length > 0) {
      await supabase
        .from('buyer_addresses')
        .update({ is_default: true })
        .eq('id', (remaining[0] as { id: string }).id)
    }
  }

  revalidatePath('/akun/alamat')
  return { success: true }
}

export async function setDefaultAddressAction(
  id: string
): Promise<{ success: true } | { error: string }> {
  const auth = await requireUser()
  if (!auth) return { error: 'Kamu harus login.' }
  const { supabase, user } = auth

  await supabase
    .from('buyer_addresses')
    .update({ is_default: false })
    .eq('buyer_id', user.id)
  const { error } = await supabase
    .from('buyer_addresses')
    .update({ is_default: true })
    .eq('id', id)
    .eq('buyer_id', user.id)
  if (error) return { error: 'Gagal mengatur alamat utama.' }
  revalidatePath('/akun/alamat')
  return { success: true }
}
