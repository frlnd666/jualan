// Audit log (Fase 4, rencana SaaS Bab 7).
// Jejak aksi penting platform — ditulis server-side lewat service_role
// (tidak ada policy insert untuk user biasa, supaya log tidak bisa
// dipalsukan dari browser). Baca hanya admin platform (RLS is_admin()).
// Best-effort: kegagalan tulis log TIDAK PERNAH menggagalkan aksi utama,
// dan tabel yang belum ada (migrasi f4 belum dijalankan) dilewati diam-diam.

import { createAdminClient } from '@/lib/supabase/admin'

export type AuditAction =
  | 'subscription_verified'
  | 'subscription_rejected'
  | 'subscription_cancelled'
  | 'store_suspended'
  | 'store_unsuspended'
  | 'staff_added'
  | 'staff_removed'
  | 'payment_confirmed'
  | 'price_changed'

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  subscription_verified: 'Langganan diverifikasi',
  subscription_rejected: 'Pembayaran langganan ditolak',
  subscription_cancelled: 'Langganan dibatalkan',
  store_suspended: 'Toko dibekukan',
  store_unsuspended: 'Pembekuan toko dibuka',
  staff_added: 'Staff ditambahkan',
  staff_removed: 'Staff dihapus',
  payment_confirmed: 'Pembayaran dikonfirmasi',
  price_changed: 'Harga produk diubah',
}

// Opsi filter untuk halaman log audit — di lib murni (bukan file
// 'use server': Next.js melarang ekspor nilai non-fungsi dari sana).
export const AUDIT_ACTION_OPTIONS: Array<{ value: AuditAction; label: string }> =
  (Object.keys(AUDIT_ACTION_LABELS) as AuditAction[]).map((action) => ({
    value: action,
    label: AUDIT_ACTION_LABELS[action],
  }))

export type AuditActorRole = 'admin' | 'seller' | 'staff' | 'system'

export interface AuditEntryInput {
  actorId?: string | null
  actorRole: AuditActorRole
  storeId?: string | null
  action: AuditAction
  entityType?: string | null
  entityId?: string | null
  details?: Record<string, unknown>
}

/** Tulis satu baris audit log. Tidak pernah melempar. */
export async function logAudit(input: AuditEntryInput): Promise<void> {
  try {
    const admin = createAdminClient()
    if (!admin) return
    const { error } = await admin.from('audit_log').insert({
      actor_id: input.actorId ?? null,
      actor_role: input.actorRole,
      store_id: input.storeId ?? null,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      details: input.details ?? {},
    })
    // Tabel belum ada (migrasi f4 belum jalan) atau RLS: lewati diam-diam.
    if (error) return
  } catch {
    return
  }
}
