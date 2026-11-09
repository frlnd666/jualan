// Aksi staff toko (Fase 2, server actions — 'use server').
//
// Pemilik menambah staff dengan email akun yang SUDAH terdaftar sebagai
// pembeli. Batas jumlah staff mengikuti tier toko (Free 0 / Silver 1 /
// Gold 3) dan ditegakkan di sini, di server — bukan di UI saja.
//
// Perubahan role dilakukan lewat service_role (admin client) supaya
// trigger profiles_role_guard mengizinkannya (trigger mengecualikan
// pemanggil tanpa JWT). Pemilik yang memanggil tetap diverifikasi
// sebagai pemilik toko lewat client ber-JWT sebelum ada perubahan.
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getOwnerStore } from '@/lib/dashboard-access'
import { getStoreSubscription } from '@/lib/subscriptions'
import { TIER_LIMITS, effectiveTier } from '@/lib/subscription-tiers'
import { logAudit } from '@/lib/audit'
import { dispatchNotify } from '@/lib/notify'

// Cari akun auth berdasarkan email lewat listUsers berhalaman
// (versi supabase-js di repo ini tidak menyediakan getUserByEmail).
async function findUserIdByEmail(
  admin: SupabaseClient,
  email: string
): Promise<string | null> {
  const wanted = email.trim().toLowerCase()
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    })
    if (error || !data.users.length) return null
    const found = data.users.find(
      (u) => (u.email ?? '').toLowerCase() === wanted
    )
    if (found) return found.id
    if (data.users.length < 1000) return null
  }
  return null
}

export type StaffMember = {
  userId: string
  email: string
  createdAt: string
}

async function requireOwner(): Promise<
  | { store: { id: string; name: string; slug: string; owner_id: string } }
  | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }
  const store = await getOwnerStore(supabase, user.id)
  if (!store) return { error: 'Kamu belum punya toko.' }
  return { store }
}

export async function listStaffAction(): Promise<
  { staff: StaffMember[]; slotsLeft: number; tierName: string } | { error: string }
> {
  const owner = await requireOwner()
  if ('error' in owner) return { error: owner.error }
  const { store } = owner

  const admin = createAdminClient()
  if (!admin) return { error: 'Konfigurasi server belum lengkap.' }
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, created_at')
    .eq('store_id', store.id)
    .eq('role', 'staff')
    .order('created_at', { ascending: true })
  const rows = (profiles ?? []) as Array<{ id: string; created_at: string }>

  const staff: StaffMember[] = []
  for (const row of rows) {
    let email = ''
    try {
      const { data } = await admin.auth.admin.getUserById(row.id)
      email = data.user?.email ?? ''
    } catch {}
    staff.push({ userId: row.id, email, createdAt: row.created_at })
  }

  // R-03: gagal baca langganan = fail-closed, terlihat oleh seller.
  let subscription
  try {
    subscription = await getStoreSubscription(admin, store.id)
  } catch {
    return { error: 'Gagal memeriksa langganan toko. Coba lagi.' }
  }
  const { tier } = effectiveTier(subscription)
  const slotsLeft = Math.max(0, TIER_LIMITS[tier].maxStaff - staff.length)
  return { staff, slotsLeft, tierName: tier }
}

export async function addStaffAction(
  email: string
): Promise<{ success: true } | { error: string }> {
  const owner = await requireOwner()
  if ('error' in owner) return { error: owner.error }
  const { store } = owner

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail.includes('@')) {
    return { error: 'Masukkan alamat email yang valid.' }
  }

  const admin = createAdminClient()
  if (!admin) return { error: 'Konfigurasi server belum lengkap.' }

  // Batas tier ditegakkan dulu, sebelum mencari akun target.
  // R-03: gagal baca langganan = fail-closed, terlihat oleh seller.
  let subscription
  try {
    subscription = await getStoreSubscription(admin, store.id)
  } catch {
    return { error: 'Gagal memeriksa langganan toko. Coba lagi.' }
  }
  const { tier } = effectiveTier(subscription)
  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', store.id)
    .eq('role', 'staff')
  if ((count ?? 0) >= TIER_LIMITS[tier].maxStaff) {
    return {
      error:
        tier === 'free'
          ? 'Paket Free tidak bisa menambah staff. Upgrade ke Silver untuk 1 staff atau Gold untuk 3 staff.'
          : `Batas staff paket ${tier === 'silver' ? 'Silver' : 'Gold'} sudah tercapai (${TIER_LIMITS[tier].maxStaff} staff).`,
    }
  }

  // Cari akun target berdasarkan email.
  let targetId: string | null = null
  try {
    targetId = await findUserIdByEmail(admin, normalizedEmail)
  } catch {
    return { error: 'Tidak dapat memeriksa akun tersebut. Coba lagi.' }
  }
  if (!targetId) {
    return {
      error:
        'Akun dengan email itu belum terdaftar. Minta calon staff daftar dulu sebagai pembeli, lalu coba lagi.',
    }
  }

  if (targetId === store.owner_id) {
    return { error: 'Email itu adalah pemilik toko ini.' }
  }

  const { data: targetProfile } = await admin
    .from('profiles')
    .select('role, store_id')
    .eq('id', targetId)
    .maybeSingle()
  const target = targetProfile as { role: string; store_id: string | null } | null

  if (target?.role === 'admin') {
    return { error: 'Akun admin platform tidak bisa dijadikan staff toko.' }
  }
  if (target?.role === 'seller') {
    return {
      error:
        'Akun itu sudah punya toko sendiri. Staff harus akun pembeli yang belum punya toko.',
    }
  }
  if (target?.role === 'staff') {
    if (target.store_id === store.id) {
      return { error: 'Akun itu sudah menjadi staff toko ini.' }
    }
    return { error: 'Akun itu sudah menjadi staff di toko lain.' }
  }

  const { error } = await admin
    .from('profiles')
    .update({ role: 'staff', store_id: store.id })
    .eq('id', targetId)
  if (error) return { error: 'Gagal menambah staff. Coba lagi.' }

  // Fase 4 — audit log (best-effort).
  await logAudit({
    actorId: owner.store.owner_id,
    actorRole: 'seller',
    storeId: store.id,
    action: 'staff_added',
    entityType: 'profile',
    entityId: targetId,
    details: { email: normalizedEmail },
  })

  // Beri tahu staff baru: in-app + email + WhatsApp. Fire-and-forget —
  // penambahan staff sudah sukses, notifikasi tidak boleh mengubahnya.
  void dispatchNotify(admin, {
    userId: targetId,
    email: normalizedEmail,
    storeId: store.id,
    type: 'STAFF_ADDED',
    title: `Kamu jadi staff ${store.name}`,
    body: 'Kamu sekarang bisa mengelola produk dan pesanan toko ini.',
    link: '/dashboard',
    data: { storeName: store.name, link: '/dashboard' },
    recipient: 'seller',
  })
  return { success: true }
}

export async function removeStaffAction(
  userId: string
): Promise<{ success: true } | { error: string }> {
  const owner = await requireOwner()
  if ('error' in owner) return { error: owner.error }
  const { store } = owner

  const admin = createAdminClient()
  if (!admin) return { error: 'Konfigurasi server belum lengkap.' }
  const { data: target } = await admin
    .from('profiles')
    .select('role, store_id')
    .eq('id', userId)
    .maybeSingle()
  const targetProfile = target as { role: string; store_id: string | null } | null
  if (targetProfile?.role !== 'staff' || targetProfile.store_id !== store.id) {
    return { error: 'Akun itu bukan staff toko ini.' }
  }

  const { error } = await admin
    .from('profiles')
    .update({ role: 'buyer', store_id: null })
    .eq('id', userId)
  if (error) return { error: 'Gagal menghapus staff. Coba lagi.' }

  // Fase 4 — audit log (best-effort).
  await logAudit({
    actorId: owner.store.owner_id,
    actorRole: 'seller',
    storeId: store.id,
    action: 'staff_removed',
    entityType: 'profile',
    entityId: userId,
  })
  return { success: true }
}
