// Halaman log audit (Fase 4) — HANYA admin platform.
// Filter aksi + toko. Menampilkan 100 baris terbaru.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/admin-access'
import { listAuditLogAction } from '@/lib/actions/audit'
import { AUDIT_ACTION_LABELS, AUDIT_ACTION_OPTIONS } from '@/lib/audit'

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(date)
}

function detailsText(details: Record<string, unknown>): string {
  const parts: string[] = []
  const d = details as Record<string, unknown>
  if (typeof d.product_name === 'string') parts.push(String(d.product_name))
  if (typeof d.old_price === 'number' && typeof d.new_price === 'number') {
    parts.push(
      `Rp ${d.old_price.toLocaleString('id-ID')} → Rp ${d.new_price.toLocaleString('id-ID')}`
    )
  }
  if (typeof d.tier === 'string') parts.push(`paket ${d.tier}`)
  if (typeof d.email === 'string') parts.push(String(d.email))
  if (typeof d.invoice_number === 'string') parts.push(String(d.invoice_number))
  if (typeof d.order_id === 'string') parts.push(`order ${String(d.order_id).slice(0, 8)}`)
  if (typeof d.payment_id === 'string') parts.push(`pembayaran ${String(d.payment_id).slice(0, 8)}`)
  if (typeof d.from_status === 'string' && typeof d.to_status === 'string') {
    parts.push(`${d.from_status} → ${d.to_status}`)
  }
  if (typeof d.error === 'string') parts.push(String(d.error))
  return parts.join(' • ')
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; storeId?: string }>
}) {
  const { action, storeId } = await searchParams
  const supabase = await createClient()
  const adminCheck = await requireAdminUser(supabase)
  if ('error' in adminCheck) redirect('/login')

  const result = await listAuditLogAction({
    action: action || undefined,
    storeId: storeId || undefined,
  })
  const rows = 'rows' in result ? result.rows : []
  const loadError = 'error' in result ? result.error : null

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-4">
      <div>
        <p className="text-sm font-medium text-[var(--text-muted)]">Admin platform</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">
          Log Audit
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Jejak aksi penting: langganan, pembekuan toko, staff, verifikasi
          pembayaran, dan perubahan harga. 100 baris terbaru.
        </p>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-center gap-2 rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-3"
      >
        <select
          name="action"
          defaultValue={action ?? ''}
          className="rounded-2xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none"
        >
          <option value="">Semua aksi</option>
          {AUDIT_ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Filter
        </button>
        {action ? (
          <Link
            href="/dashboard/admin/audit"
            className="rounded-2xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--text)]"
          >
            Reset
          </Link>
        ) : null}
      </form>

      {loadError ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      {rows.length === 0 && !loadError ? (
        <p className="rounded-3xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
          Belum ada log audit.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold text-[var(--text)]">
                  {AUDIT_ACTION_LABELS[row.action as keyof typeof AUDIT_ACTION_LABELS] ??
                    row.action}
                </p>
                <span className="shrink-0 text-xs text-[var(--text-muted)]">
                  {formatDateTime(row.created_at)}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {row.actor_role}
                {row.actor_id ? ` • ${row.actor_id.slice(0, 8)}…` : ''}
                {row.store_name ? ` • ${row.store_name}` : ''}
              </p>
              {detailsText(row.details) ? (
                <p className="mt-2 text-sm text-[var(--text)]">
                  {detailsText(row.details)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
