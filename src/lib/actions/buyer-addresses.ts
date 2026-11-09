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

// P1-10: jadikan alamat sebagai default lewat RPC atomik
// set_default_buyer_address (satu transaksi + partial unique index) —
// dua update terpisah ("matikan semua" lalu "nyalakan satu") bisa
// meninggalkan 0 atau 2 alamat default bila dipanggil bersamaan.
async function setDefaultById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  addressId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('set_default_buyer_address', {
    p_address_id: addressId,
  })
  if (error) return false
  return data === true
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

  // P1-10: sisipkan dulu sebagai bukan default, lalu jadikan default
  // lewat RPC — urutan lama (matikan default lain dulu, baru sisip)
  // bisa meninggalkan 0 default bila sisipnya gagal.
  const { data: inserted, error } = await supabase
    .from('buyer_addresses')
    .insert({
      buyer_id: user.id,
      ...toRow(input),
      is_default: false,
    })
    .select('id')
    .single()
  if (error || !inserted) return { error: 'Gagal menyimpan alamat.' }
  if (makeDefault) {
    const ok = await setDefaultById(supabase, (inserted as { id: string }).id)
    if (!ok) {
      return {
        error:
          'Alamat tersimpan, tapi gagal menjadikannya alamat utama. Atur manual di daftar alamat.',
      }
    }
  }
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

  const row = toRow(input)
  const { error } = await supabase
    .from('buyer_addresses')
    .update({
      ...row,
      // P1-10: bila alamat ini dijadikan default, biarkan RPC di bawah
      // yang menyalakannya — update langsung dengan is_default=true
      // ditolak partial unique index selama default lama masih menyala.
      is_default: input.isDefault ? false : row.is_default,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('buyer_id', user.id)
  if (error) return { error: 'Gagal mengubah alamat.' }
  if (input.isDefault) {
    const ok = await setDefaultById(supabase, id)
    if (!ok) {
      return {
        error:
          'Alamat tersimpan, tapi gagal menjadikannya alamat utama. Atur manual di daftar alamat.',
      }
    }
  }
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
  // pilihan utama. P1-10: lewat RPC atomik (bukan update langsung).
  if ((target as { is_default: boolean }).is_default) {
    const { data: remaining } = await supabase
      .from('buyer_addresses')
      .select('id')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
    if (remaining && remaining.length > 0) {
      await setDefaultById(supabase, (remaining[0] as { id: string }).id)
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
  const { supabase } = auth

  // P1-10: satu pemanggilan RPC atomik menggantikan dua update
  // terpisah. RPC mengembalikan false bila alamat tidak ada / bukan
  // milik pemanggil — perilaku lama mengklaim sukses bahkan untuk id
  // yang tidak cocok (update 0 baris tanpa error).
  const ok = await setDefaultById(supabase, id)
  if (!ok) return { error: 'Gagal mengatur alamat utama.' }
  revalidatePath('/akun/alamat')
  return { success: true }
}
