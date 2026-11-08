// Server action trigger manual cron transisi langganan (admin-only).
// Memanggil logika yang SAMA dengan route cron
// (/api/cron/subscription-transitions) — dipakai untuk testing tanpa
// menunggu jadwal cron, dan untuk mengejar ketertinggalan bila cron
// sempat tidak jalan. Aman diulang: transisi idempotent, pengingat
// di-dedup per hari.
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  runSubscriptionTransitions,
  type SubscriptionRunSummary,
} from '@/lib/subscription-transitions'

export async function runSubscriptionTransitionsAction(): Promise<
  | { success: true; summary: SubscriptionRunSummary }
  | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin')
  if (adminError || isAdmin !== true) {
    return { error: 'Hanya admin platform yang boleh menjalankan transisi.' }
  }

  const admin = createAdminClient()
  if (!admin) {
    return { error: 'Server belum dikonfigurasi (service role belum diset).' }
  }

  const summary = await runSubscriptionTransitions(admin)
  revalidatePath('/dashboard/admin/subscriptions')
  return { success: true, summary }
}
