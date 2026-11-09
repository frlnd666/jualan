// Cron transisi status langganan (rencana SaaS Bab 4 + Bab 6).
//
// Dijalankan 1x sehari oleh Vercel Cron (vercel.json →
// GET /api/cron/subscription-transitions, 07:00 WIB) atau manual oleh
// admin dari /dashboard/admin/subscriptions. Aman diulang tiap hari:
// - Transisi bersifat idempotent — sesudah status berubah, baris itu
//   tidak lagi cocok dengan kondisi pemicu, jadi run kedua di hari yang
//   sama tidak melakukan apa-apa.
// - Pengingat H-3/H-1 di-dedup per toko + jenis + hari kalender WIB
//   (dicek ke tabel notifications sebelum mengirim).
//
// Aturan status (Bab 4):
// - TRIALING habis (trial_ends_at lewat) → Free/ACTIVE.
// - ACTIVE berbayar habis (current_period_end lewat) → PAST_DUE +
//   grace_ends_at = akhir periode + 7 hari (toko tetap jualan,
//   fitur premium baru terkunci — penegakan di effectiveTier).
// - PAST_DUE habis masa tenggang → EXPIRED + tier Free (produk di atas
//   batas disembunyikan di read-time, bukan dihapus).
// - CANCELLED habis periode → Free/ACTIVE.
// - SUSPENDED dan EXPIRED tidak disentuh cron (SUSPENDED hanya admin).
//
// File ini TIDAK butuh migrasi baru: audit_log.action bebas teks,
// notifications.type bebas teks, dan dedup pengingat memakai query
// ke tabel notifications yang sudah ada (Fase 3).

import type { SupabaseClient } from '@supabase/supabase-js'
import { GRACE_DAYS } from '@/lib/subscription-tiers'
import type { SubscriptionStatus, Tier } from '@/lib/subscription-tiers'
import { logAudit } from '@/lib/audit'
import { logEvent } from '@/lib/observability'
import { dispatchNotify } from '@/lib/notify'

export type TransitionKind =
  | 'trial-ended'
  | 'past-due'
  | 'expired'
  | 'cancelled-ended'

export interface TransitionRow {
  id: string
  store_id: string
  tier: Tier
  status: SubscriptionStatus
  trial_ends_at: string | null
  current_period_start: string | null
  current_period_end: string | null
  grace_ends_at: string | null
}

export interface TransitionDecision {
  kind: TransitionKind
  /** Kolom subscriptions yang ditulis (update parsial). */
  updates: Partial<
    Pick<
      TransitionRow,
      | 'tier'
      | 'status'
      | 'trial_ends_at'
      | 'current_period_start'
      | 'current_period_end'
      | 'grace_ends_at'
    >
  >
}

/** Tanggal kalender (YYYY-MM-DD) sebuah waktu di zona Asia/Jakarta. */
export function wibDayString(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * Selisih hari kalender WIB antara `from` dan `to`
 * (positif bila `to` di masa depan). Dipakai jendela pengingat H-3/H-1:
 * "3 hari lagi" dihitung dari tanggal kalender, bukan 72 jam persis.
 */
export function wibDaysUntil(from: Date, to: Date): number {
  const a = Date.parse(`${wibDayString(from)}T00:00:00Z`)
  const b = Date.parse(`${wibDayString(to)}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

/** Awal hari kalender WIB `d` sebagai ISO (untuk query created_at). */
export function wibDayStartIso(d: Date): string {
  return new Date(`${wibDayString(d)}T00:00:00+07:00`).toISOString()
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function toIso(d: Date | null): string | null {
  return d ? d.toISOString() : null
}

/**
 * Keputusan transisi untuk satu baris subscriptions pada saat `now`.
 * Murni (tidak menyentuh DB) supaya gampang dites. Mengembalikan null
 * bila tidak ada yang harus berubah — termasuk untuk SUSPENDED dan
 * EXPIRED yang memang tidak disentuh cron.
 */
export function decideTransition(
  row: TransitionRow,
  now: Date = new Date()
): TransitionDecision | null {
  const trialDeadline = row.trial_ends_at
    ? new Date(row.trial_ends_at)
    : row.current_period_end
      ? new Date(row.current_period_end)
      : null
  const periodDeadline = row.current_period_end
    ? new Date(row.current_period_end)
    : null

  if (row.status === 'TRIALING') {
    if (!trialDeadline || now < trialDeadline) return null
    return {
      kind: 'trial-ended',
      updates: {
        tier: 'free',
        status: 'ACTIVE',
        trial_ends_at: null,
        current_period_start: null,
        current_period_end: null,
        grace_ends_at: null,
      },
    }
  }

  if (row.status === 'ACTIVE') {
    if (row.tier === 'free' || !periodDeadline || now < periodDeadline) {
      return null
    }
    return {
      kind: 'past-due',
      updates: {
        status: 'PAST_DUE',
        grace_ends_at: toIso(addDays(periodDeadline, GRACE_DAYS)),
      },
    }
  }

  if (row.status === 'PAST_DUE') {
    const graceDeadline = row.grace_ends_at
      ? new Date(row.grace_ends_at)
      : periodDeadline
        ? addDays(periodDeadline, GRACE_DAYS)
        : null
    if (!graceDeadline || now < graceDeadline) return null
    return {
      kind: 'expired',
      updates: {
        tier: 'free',
        status: 'EXPIRED',
        trial_ends_at: null,
        grace_ends_at: null,
      },
    }
  }

  if (row.status === 'CANCELLED') {
    if (!periodDeadline || now < periodDeadline) return null
    return {
      kind: 'cancelled-ended',
      updates: {
        tier: 'free',
        status: 'ACTIVE',
        trial_ends_at: null,
        current_period_start: null,
        current_period_end: null,
        grace_ends_at: null,
      },
    }
  }

  return null
}

export type ReminderKind = 'trial' | 'period'

export interface ReminderDue {
  kind: ReminderKind
  /** Sisa hari kalender WIB: hanya 3 atau 1 yang memicu pengingat. */
  daysLeft: 3 | 1
}

/**
 * Apakah baris ini jatuh di jendela pengingat H-3 atau H-1 pada `now`?
 * Hanya TRIALING (sebelum trial berakhir) dan ACTIVE berbayar (sebelum
 * periode berakhir). H-0 tidak mengingatkan — transisinya sendiri yang
 * memberi tahu pemilik toko.
 */
export function reminderDue(
  row: TransitionRow,
  now: Date = new Date()
): ReminderDue | null {
  const deadline =
    row.status === 'TRIALING'
      ? row.trial_ends_at ?? row.current_period_end
      : row.status === 'ACTIVE' && row.tier !== 'free'
        ? row.current_period_end
        : null
  if (!deadline) return null
  const daysLeft = wibDaysUntil(now, new Date(deadline))
  if (daysLeft !== 3 && daysLeft !== 1) return null
  return { kind: row.status === 'TRIALING' ? 'trial' : 'period', daysLeft }
}

// ---------------------------------------------------------------------------
// Pesan notifikasi (Bahasa Indonesia). Link selalu ke /dashboard/subscription.
// ---------------------------------------------------------------------------

const REMINDER_TYPE = {
  trial: 'TRIAL_ENDING_SOON',
  period: 'SUBSCRIPTION_ENDING_SOON',
} as const

const TRANSITION_TYPE = {
  'trial-ended': 'TRIAL_ENDED',
  'past-due': 'SUBSCRIPTION_PAST_DUE',
  expired: 'SUBSCRIPTION_EXPIRED',
  'cancelled-ended': 'SUBSCRIPTION_ENDED',
} as const

function whenText(daysLeft: 3 | 1): string {
  return daysLeft === 3 ? '3 hari lagi' : 'besok'
}

function reminderMessage(
  kind: ReminderKind,
  daysLeft: 3 | 1,
  storeName: string,
  tier: Tier
): { title: string; body: string } {
  if (kind === 'trial') {
    return {
      title: `Masa percobaan ${storeName} berakhir ${whenText(daysLeft)}`,
      body: 'Perpanjang ke Silver atau Gold sebelum trial berakhir supaya fitur premium tetap aktif.',
    }
  }
  return {
    title: `Langganan ${tier === 'gold' ? 'Gold' : 'Silver'} ${storeName} berakhir ${whenText(daysLeft)}`,
    body: 'Perpanjang sebelum tanggal berakhir supaya tokomu tetap di paket berbayar.',
  }
}

function transitionMessage(
  kind: TransitionKind,
  storeName: string
): { title: string; body: string } {
  switch (kind) {
    case 'trial-ended':
      return {
        title: `Masa percobaan ${storeName} berakhir`,
        body: 'Tokomu sekarang memakai paket Free. Upgrade ke Silver atau Gold untuk membuka lagi fitur premium.',
      }
    case 'past-due':
      return {
        title: `Pembayaran langganan ${storeName} telat`,
        body: 'Masa tenggang 7 hari — toko tetap bisa jualan, tapi fitur premium baru terkunci. Perpanjang segera.',
      }
    case 'expired':
      return {
        title: `Langganan ${storeName} berakhir`,
        body: `Masa tenggang habis — toko turun ke paket Free. Produk di atas batas disembunyikan (tidak dihapus).`,
      }
    case 'cancelled-ended':
      return {
        title: `Langganan ${storeName} berakhir`,
        body: 'Periode berbayar selesai — toko sekarang memakai paket Free.',
      }
  }
}

// ---------------------------------------------------------------------------
// Orkestrasi (dipakai route cron + tombol manual admin).
// ---------------------------------------------------------------------------

export interface SubscriptionRunSummary {
  processed: number
  transitions: Record<TransitionKind, number>
  reminders: Record<ReminderKind, number>
  remindersSkippedDuplicate: number
  errors: string[]
}

export interface StoreInfo {
  name: string
  slug: string
  owner_id: string
}

type RowWithStore = TransitionRow & { stores: StoreInfo | StoreInfo[] | null }

function storeOf(row: RowWithStore): StoreInfo | null {
  if (!row.stores) return null
  return Array.isArray(row.stores) ? (row.stores[0] ?? null) : row.stores
}

/**
 * Jalankan satu putaran transisi + pengingat untuk SEMUA langganan.
 * `admin` harus client service_role (melewati RLS). Best-effort per
 * baris: satu baris gagal tidak menghentikan baris lain; kegagalan
 * dicatat di summary.errors. Update baris memakai syarat status lama
 * (`.eq('status', ...)`) supaya dua run bersamaan tidak menggandakan
 * efek — run kedua tidak menemukan baris yang cocok lagi.
 */
export async function runSubscriptionTransitions(
  admin: SupabaseClient,
  now: Date = new Date()
): Promise<SubscriptionRunSummary> {
  const summary: SubscriptionRunSummary = {
    processed: 0,
    transitions: {
      'trial-ended': 0,
      'past-due': 0,
      expired: 0,
      'cancelled-ended': 0,
    },
    reminders: { trial: 0, period: 0 },
    remindersSkippedDuplicate: 0,
    errors: [],
  }

  const { data, error } = await admin
    .from('subscriptions')
    .select(
      'id, store_id, tier, status, trial_ends_at, current_period_start, current_period_end, grace_ends_at, stores!inner(id, name, slug, owner_id)'
    )
  if (error || !data) {
    summary.errors.push(`Gagal membaca subscriptions: ${error?.message ?? 'tidak ada data'}`)
    return summary
  }

  const dayStartIso = wibDayStartIso(now)

  for (const raw of data as RowWithStore[]) {
    summary.processed += 1
    const store = storeOf(raw)
    if (!store) {
      summary.errors.push(`Langganan ${raw.id}: toko tidak ditemukan.`)
      continue
    }

    const decision = decideTransition(raw, now)
    if (decision) {
      // Update bersyarat status lama — idempotent terhadap run ganda.
      const { data: updated, error: updateError } = await admin
        .from('subscriptions')
        .update(decision.updates)
        .eq('id', raw.id)
        .eq('status', raw.status)
        .select('id')
      if (updateError) {
        summary.errors.push(
          `Langganan ${raw.id} (${store.slug}): gagal update — ${updateError.message}`
        )
        continue
      }
      if (!updated || updated.length === 0) {
        // Sudah diubah run lain di antaranya — lewati efek samping.
        continue
      }
      summary.transitions[decision.kind] += 1

      await logAudit({
        actorId: null,
        actorRole: 'system',
        storeId: raw.store_id,
        action:
          decision.kind === 'trial-ended'
            ? 'subscription_trial_ended'
            : decision.kind === 'past-due'
              ? 'subscription_past_due'
              : decision.kind === 'expired'
                ? 'subscription_expired'
                : 'subscription_ended',
        entityType: 'subscription',
        entityId: raw.id,
        details: {
          from_status: raw.status,
          from_tier: raw.tier,
          to_status: decision.updates.status,
          to_tier: decision.updates.tier ?? raw.tier,
        },
      })

      const msg = transitionMessage(decision.kind, store.name)
      // Notifikasi ke pemilik toko lewat dispatcher yang sama dengan
      // event lain: in-app + email + WhatsApp sesuai preferensi.
      // Cron memang background, jadi di-await (bukan fire-and-forget).
      await dispatchNotify(admin, {
        userId: store.owner_id,
        storeId: raw.store_id,
        type: TRANSITION_TYPE[decision.kind],
        title: msg.title,
        body: msg.body,
        link: '/dashboard/subscription',
        data: {
          storeName: store.name,
          tier: raw.tier,
          link: '/dashboard/subscription',
        },
        recipient: 'seller',
      })
      continue
    }

    const reminder = reminderDue(raw, now)
    if (!reminder) continue

    // Dedup: pengingat jenis ini untuk toko ini sudah dikirim hari ini (WIB)?
    const type = REMINDER_TYPE[reminder.kind]
    const { data: existing } = await admin
      .from('notifications')
      .select('id')
      .eq('store_id', raw.store_id)
      .eq('type', type)
      .gte('created_at', dayStartIso)
      .limit(1)
    if (existing && existing.length > 0) {
      summary.remindersSkippedDuplicate += 1
      continue
    }

    const msg = reminderMessage(reminder.kind, reminder.daysLeft, store.name, raw.tier)
    // Pengingat H-3/H-1 lewat dispatcher yang sama (in-app + email +
    // WA). Dedup di atas tetap berlaku — dispatcher tidak menduplikasi
    // logika dedup, hanya mengirim.
    const dispatched = await dispatchNotify(admin, {
      userId: store.owner_id,
      storeId: raw.store_id,
      type,
      title: msg.title,
      body: msg.body,
      link: '/dashboard/subscription',
      data: {
        storeName: store.name,
        tier: raw.tier,
        daysLeft: reminder.daysLeft,
        link: '/dashboard/subscription',
      },
      recipient: 'seller',
    })
    const sent = dispatched.inApp
    if (sent) {
      summary.reminders[reminder.kind] += 1
    } else {
      summary.errors.push(
        `Langganan ${raw.id} (${store.slug}): gagal kirim pengingat ${type}.`
      )
    }
  }

  logEvent('subscription_transitions_run', {
    processed: summary.processed,
    transitions: summary.transitions,
    reminders: summary.reminders,
    skippedDuplicates: summary.remindersSkippedDuplicate,
    errors: summary.errors.length,
  })

  return summary
}
