// Voucher / diskon per toko — SERVER ACTIONS (Fase 3).
// - CRUD voucher: owner-only + tier-gated (Free TIDAK bisa membuat
//   voucher — TIER_LIMITS.free.vouchers = false).
// - Validasi kode saat checkout: publik (dipanggil halaman checkout),
//   memakai public invoice client (service_role bila tersedia) —
//   TIDAK ada policy select publik di tabel vouchers.

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createPublicInvoiceClient } from '@/lib/invoice-access'
import { getOwnerStore } from '@/lib/dashboard-access'
import { getStoreSubscription, limitsFor } from '@/lib/subscriptions'
import {
  canCreateVoucher,
  normalizeVoucherCode,
  validateVoucher,
  type VoucherLike,
} from '@/lib/vouchers'

export interface VoucherRow extends VoucherLike {
  created_at: string
}

function isValidCode(code: string): boolean {
  return /^[A-Z0-9][A-Z0-9_-]{2,19}$/.test(code)
}

export async function listVouchersAction(): Promise<
  VoucherRow[] | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const store = await getOwnerStore(supabase, user.id)
  if (!store) return { error: 'Toko tidak ditemukan untuk akun ini.' }

  const { data, error } = await supabase
    .from('vouchers')
    .select(
      'id, store_id, code, discount_type, discount_value, min_order, max_uses, used_count, starts_at, ends_at, is_active'
    )
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })

  if (error) return { error: 'Gagal memuat voucher.' }
  return (data ?? []) as VoucherRow[]
}

export async function createVoucherAction(
  formData: FormData
): Promise<{ success?: string; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const store = await getOwnerStore(supabase, user.id)
  if (!store) return { error: 'Toko tidak ditemukan untuk akun ini.' }

  // Tier gate: Free tidak boleh membuat voucher; PAST_DUE mengunci
  // fitur premium baru (termasuk voucher baru).
  // R-03: gagal baca langganan = fail-closed, terlihat oleh seller.
  let subscription
  try {
    subscription = await getStoreSubscription(supabase, store.id)
  } catch {
    return { error: 'Gagal memeriksa langganan toko. Coba lagi.' }
  }
  const limits = limitsFor(subscription)
  if (!canCreateVoucher(limits.vouchers, subscription.status === 'PAST_DUE')) {
    return {
      error:
        'Voucher hanya untuk paket Silver/Gold. Upgrade paketmu di halaman Langganan untuk memakai fitur ini.',
    }
  }

  const code = normalizeVoucherCode(String(formData.get('code') ?? ''))
  const discountType = String(formData.get('discountType') ?? '')
  const discountValue = Math.floor(Number(formData.get('discountValue') ?? 0))
  const minOrder = Math.max(0, Math.floor(Number(formData.get('minOrder') ?? 0)))
  const maxUsesRaw = String(formData.get('maxUses') ?? '').trim()
  const maxUses = maxUsesRaw ? Math.floor(Number(maxUsesRaw)) : null
  const startsAt = String(formData.get('startsAt') ?? '').trim() || null
  const endsAt = String(formData.get('endsAt') ?? '').trim() || null

  if (!isValidCode(code)) {
    return {
      error: 'Kode voucher 3–20 karakter, huruf/angka/strip saja (mis. HEMAT10).',
    }
  }
  if (discountType !== 'percent' && discountType !== 'fixed') {
    return { error: 'Tipe diskon tidak valid.' }
  }
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return { error: 'Nilai diskon harus lebih dari 0.' }
  }
  if (discountType === 'percent' && discountValue > 100) {
    return { error: 'Diskon persen maksimal 100%.' }
  }
  if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses < 1)) {
    return { error: 'Maksimal pemakaian harus 1 atau lebih (kosongkan = tanpa batas).' }
  }
  if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
    return { error: 'Tanggal mulai harus sebelum tanggal berakhir.' }
  }

  const { error } = await supabase.from('vouchers').insert({
    store_id: store.id,
    code,
    discount_type: discountType,
    discount_value: discountValue,
    min_order: minOrder,
    max_uses: maxUses,
    starts_at: startsAt,
    ends_at: endsAt,
    is_active: true,
  })

  if (error) {
    // Kode duplikat per toko (unique index store_id + upper(code)).
    if (String(error.code) === '23505') {
      return { error: `Kode ${code} sudah dipakai di tokomu.` }
    }
    return { error: 'Gagal membuat voucher.' }
  }

  revalidatePath('/dashboard/vouchers')
  return { success: `Voucher ${code} dibuat.` }
}

export async function toggleVoucherAction(
  voucherId: string,
  isActive: boolean
): Promise<{ success?: string; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const store = await getOwnerStore(supabase, user.id)
  if (!store) return { error: 'Toko tidak ditemukan untuk akun ini.' }

  const { error } = await supabase
    .from('vouchers')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', voucherId)
    .eq('store_id', store.id)

  if (error) return { error: 'Gagal mengubah status voucher.' }
  revalidatePath('/dashboard/vouchers')
  return { success: isActive ? 'Voucher diaktifkan.' : 'Voucher dinonaktifkan.' }
}

export async function deleteVoucherAction(
  voucherId: string
): Promise<{ success?: string; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const store = await getOwnerStore(supabase, user.id)
  if (!store) return { error: 'Toko tidak ditemukan untuk akun ini.' }

  const { error } = await supabase
    .from('vouchers')
    .delete()
    .eq('id', voucherId)
    .eq('store_id', store.id)

  if (error) return { error: 'Gagal menghapus voucher.' }
  revalidatePath('/dashboard/vouchers')
  return { success: 'Voucher dihapus.' }
}

export interface ValidateVoucherResult {
  ok: boolean
  discount: number
  code: string | null
  error?: string
}

/**
 * Validasi kode voucher untuk checkout (publik). Mengembalikan diskon
 * yang berlaku untuk subtotal ini — penegakan final tetap di
 * createOrderAction (validasi diulang + kuota dicek atomik di sana),
 * jadi respons di sini hanya preview untuk pembeli.
 */
export async function validateVoucherCodeAction(
  storeId: string,
  code: string,
  subtotal: number
): Promise<ValidateVoucherResult> {
  const normalized = normalizeVoucherCode(code)
  if (!storeId || !normalized) {
    return { ok: false, discount: 0, code: null, error: 'Kode voucher kosong.' }
  }

  const supabase = await createPublicInvoiceClient()
  const { data, error } = await supabase
    .from('vouchers')
    .select(
      'id, store_id, code, discount_type, discount_value, min_order, max_uses, used_count, starts_at, ends_at, is_active'
    )
    .eq('store_id', storeId)
    .eq('code', normalized)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, discount: 0, code: null, error: 'Kode voucher tidak ditemukan.' }
  }

  const voucher = data as VoucherLike
  const result = validateVoucher(voucher, Math.max(0, Math.floor(subtotal)))
  if (!result.ok) {
    return { ok: false, discount: 0, code: null, error: result.error }
  }
  return { ok: true, discount: result.discount, code: voucher.code }
}

/**
 * Dipakai createOrderAction (server-side, bukan dari browser):
 * ambil voucher + validasi + catat pemakaian. Mengembalikan voucher
 * bila valid, null bila tidak ada kode / tidak valid (checkout lanjut
 * tanpa diskon — BUKAN error, supaya voucher salah ketik tidak
 * mematikan pesanan; preview di halaman sudah memberi tahu pembeli).
 */
export async function loadVoucherForCheckout(
  supabase: Awaited<ReturnType<typeof createPublicInvoiceClient>>,
  storeId: string,
  code: string,
  subtotal: number
): Promise<{ voucher: VoucherLike; discount: number } | null> {
  const normalized = normalizeVoucherCode(code)
  if (!normalized) return null
  const { data, error } = await supabase
    .from('vouchers')
    .select(
      'id, store_id, code, discount_type, discount_value, min_order, max_uses, used_count, starts_at, ends_at, is_active'
    )
    .eq('store_id', storeId)
    .eq('code', normalized)
    .maybeSingle()
  if (error || !data) return null
  const voucher = data as VoucherLike
  const result = validateVoucher(voucher, subtotal)
  if (!result.ok) return null
  return { voucher, discount: result.discount }
}
