// Audit log — SERVER ACTIONS (Fase 4).
// - listAuditLogAction: HANYA admin platform (requireAdminUser).
//   Filter: aksi + toko (slug/id) + pagination (default 50/halaman).
// - logAuditAction: dipanggil dari halaman client (edit produk) setelah
//   perubahan harga berhasil — server memverifikasi pemanggil memang
//   pemilik/staff toko itu sebelum mencatat; best-effort, tidak pernah
//   melempar error yang mengganggu alur utama.

'use server'

import { createClient } from '@/lib/supabase/server'
import { getDashboardAccess } from '@/lib/dashboard-access'
import { requireAdminUser } from '@/lib/admin-access'
import { logAudit } from '@/lib/audit'

export interface AuditLogRow {
  id: string
  actor_id: string | null
  actor_role: string
  store_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown>
  created_at: string
  store_name: string | null
  actor_email: string | null
}

export async function listAuditLogAction(input: {
  action?: string
  storeId?: string
  /** Pagination server-side (redesign admin 2026-11-10). */
  page?: number
  pageSize?: number
}): Promise<{ rows: AuditLogRow[]; total: number } | { error: string }> {
  const supabase = await createClient()
  const adminCheck = await requireAdminUser(supabase)
  if ('error' in adminCheck) return { error: adminCheck.error }

  const pageSize = Math.min(100, Math.max(1, Math.floor(input.pageSize ?? 50)))
  const page = Math.max(1, Math.floor(input.page ?? 1))
  const from = (page - 1) * pageSize

  let query = supabase
    .from('audit_log')
    .select(
      'id, actor_id, actor_role, store_id, action, entity_type, entity_id, details, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)
  if (input.action) query = query.eq('action', input.action)
  if (input.storeId) query = query.eq('store_id', input.storeId)

  const { data, error, count } = await query
  if (error) {
    return { error: 'Log audit belum tersedia — jalankan migrasi Fase 4 dulu.' }
  }

  const rows = (data ?? []) as Omit<AuditLogRow, 'store_name' | 'actor_email'>[]
  const storeIds = [...new Set(rows.map((r) => r.store_id).filter(Boolean))] as string[]
  const storeNames = new Map<string, string>()
  if (storeIds.length > 0) {
    const { data: stores } = await supabase
      .from('stores')
      .select('id, name')
      .in('id', storeIds)
    for (const s of (stores ?? []) as Array<{ id: string; name: string }>) {
      storeNames.set(s.id, s.name)
    }
  }

  return {
    total: count ?? rows.length,
    rows: rows.map((r) => ({
      ...r,
      details: (r.details ?? {}) as Record<string, unknown>,
      store_name: r.store_id ? (storeNames.get(r.store_id) ?? null) : null,
      // Email actor tidak diambil di sini (butuh Auth Admin API per baris
      // — mahal); tampilkan sebagian id saja di UI.
      actor_email: null,
    })),
  }
}

/** Catat perubahan harga produk dari halaman edit (client). */
export async function logPriceChangedAction(input: {
  productId: string
  productName: string
  oldPrice: number
  newPrice: number
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const access = await getDashboardAccess(supabase, user.id)
  if (!access) return { error: 'Toko tidak ditemukan untuk akun ini.' }

  if (!input.productId || !Number.isFinite(input.newPrice)) {
    return { error: 'Data tidak valid.' }
  }
  if (Math.floor(input.oldPrice) === Math.floor(input.newPrice)) {
    return { success: true }
  }

  // P2-01: jangan percaya productId/nama/harga dari client — baca produk
  // dari DB dan pastikan milik toko pemanggil. Harga baru diambil dari DB
  // (aksi ini dipanggil SETELAH updateProductAction berhasil, jadi harga
  // di DB sudah harga baru). Harga lama tidak bisa diverifikasi ulang
  // dari DB karena sudah tertimpa — yang dipastikan di sini adalah
  // perubahannya nyata (harga DB sudah berbeda dari yang diklaim lama)
  // dan produknya memang milik toko ini.
  const { data: product } = await supabase
    .from('products')
    .select('id, name, price')
    .eq('id', input.productId)
    .eq('store_id', access.store.id)
    .maybeSingle()
  const owned = product as { id: string; name: string; price: number } | null
  if (!owned) {
    return { error: 'Produk tidak ditemukan di tokomu.' }
  }
  const dbPrice = Math.floor(Number(owned.price))
  if (dbPrice === Math.floor(input.oldPrice)) {
    // Harga di DB masih harga lama — update tidak terjadi, jangan catat
    // perubahan yang tidak ada.
    return { success: true }
  }

  await logAudit({
    actorId: user.id,
    actorRole: access.role === 'staff' ? 'staff' : 'seller',
    storeId: access.store.id,
    action: 'price_changed',
    entityType: 'product',
    entityId: input.productId,
    details: {
      product_name: owned.name,
      old_price: Math.floor(input.oldPrice),
      new_price: dbPrice,
    },
  })
  return { success: true }
}
