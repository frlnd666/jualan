// Aksi admin platform (Fase 2, 'use server'): bekukan / buka bekukan
// toko lewat status langganan SUSPENDED.
//
// Bekukan: status → SUSPENDED (storefront 404, checkout mati — lihat
// lib/subscriptions.ts). Buka bekukan: kembalikan status yang masuk
// akal dari data yang tersisa — Free → ACTIVE; Silver/Gold yang masa
// trial-nya masih berjalan → TRIALING; selebihnya ACTIVE. Status
// sebelumnya tidak disimpan di baris langganan (Fase 1), jadi
// rekonstruksi ini didokumentasikan di sini.
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminUser } from '@/lib/admin-access'
import { logAudit } from '@/lib/audit'

export async function suspendStoreAction(
  storeId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const adminCheck = await requireAdminUser(supabase)
  if ('error' in adminCheck) return { error: adminCheck.error }

  const admin = createAdminClient()
  if (!admin) return { error: 'Konfigurasi server belum lengkap.' }

  // P1-08: baca dulu + guard status — suspend buta bisa menimpa
  // perubahan lain (mis. admin lain sudah membuka pembekuan) dan
  // menulis audit ganda untuk status yang tidak berubah.
  const { data: row } = await admin
    .from('subscriptions')
    .select('status')
    .eq('store_id', storeId)
    .maybeSingle()
  const sub = row as { status: string } | null
  if (!sub) return { error: 'Langganan toko tidak ditemukan.' }
  if (sub.status === 'SUSPENDED') {
    return { error: 'Toko ini sudah dibekukan.' }
  }

  const { data: updated, error } = await admin
    .from('subscriptions')
    .update({ status: 'SUSPENDED' })
    .eq('store_id', storeId)
    .eq('status', sub.status)
    .select('id')
  if (error) return { error: 'Gagal membekukan toko.' }
  if (!updated || updated.length === 0) {
    return { error: 'Status langganan sudah berubah. Muat ulang halaman.' }
  }

  // Fase 4 — audit log (best-effort).
  await logAudit({
    actorId: adminCheck.userId,
    actorRole: 'admin',
    storeId,
    action: 'store_suspended',
    entityType: 'store',
    entityId: storeId,
  })

  revalidatePath('/dashboard/admin')
  revalidatePath(`/dashboard/admin/stores/${storeId}`)
  return { success: true }
}

export async function unsuspendStoreAction(
  storeId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const adminCheck = await requireAdminUser(supabase)
  if ('error' in adminCheck) return { error: adminCheck.error }

  const admin = createAdminClient()
  if (!admin) return { error: 'Konfigurasi server belum lengkap.' }

  const { data: row } = await admin
    .from('subscriptions')
    .select('tier, status, trial_ends_at')
    .eq('store_id', storeId)
    .maybeSingle()
  const sub = row as {
    tier: string
    status: string
    trial_ends_at: string | null
  } | null
  if (!sub) return { error: 'Langganan toko tidak ditemukan.' }
  if (sub.status !== 'SUSPENDED') {
    return { error: 'Toko ini tidak sedang dibekukan.' }
  }

  const now = new Date()
  const restoreTo =
    sub.tier === 'free'
      ? 'ACTIVE'
      : sub.trial_ends_at && new Date(sub.trial_ends_at) > now
        ? 'TRIALING'
        : 'ACTIVE'

  const { data: updated, error } = await admin
    .from('subscriptions')
    .update({ status: restoreTo })
    .eq('store_id', storeId)
    .eq('status', 'SUSPENDED')
    .select('id')
  if (error) return { error: 'Gagal membuka pembekuan toko.' }
  if (!updated || updated.length === 0) {
    // P1-08: kalah race dengan admin lain / cron — jangan tulis audit
    // seolah pembekuan berhasil dibuka.
    return { error: 'Status langganan sudah berubah. Muat ulang halaman.' }
  }

  // Fase 4 — audit log (best-effort).
  await logAudit({
    actorId: adminCheck.userId,
    actorRole: 'admin',
    storeId,
    action: 'store_unsuspended',
    entityType: 'store',
    entityId: storeId,
    details: { from_status: 'SUSPENDED', to_status: restoreTo },
  })

  revalidatePath('/dashboard/admin')
  revalidatePath(`/dashboard/admin/stores/${storeId}`)
  return { success: true }
}
