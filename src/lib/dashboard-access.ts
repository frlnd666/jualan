// Penentu toko untuk halaman dashboard (Fase 2).
//
// Pemilik toko → toko dengan owner_id = user.
// Staff → toko dari profiles.store_id (role 'staff').
// Admin platform tidak punya toko lewat helper ini (admin pakai panel
// /dashboard/admin, bukan dashboard toko).
import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type DashboardStore = {
  id: string
  name: string
  slug: string
  owner_id: string
  onboarding_step?: number | null
}

export type DashboardAccess =
  | { store: DashboardStore; role: 'owner' }
  | { store: DashboardStore; role: 'staff' }
  | null

export async function getDashboardAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<DashboardAccess> {
  const { data: owned } = await supabase
    .from('stores')
    .select('id, name, slug, owner_id, onboarding_step')
    .eq('owner_id', userId)
    .maybeSingle()
  if (owned) {
    return { store: owned as DashboardStore, role: 'owner' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, store_id')
    .eq('id', userId)
    .maybeSingle()
  const staffProfile = profile as { role: string; store_id: string | null } | null
  if (staffProfile?.role === 'staff' && staffProfile.store_id) {
    const { data: store } = await supabase
      .from('stores')
      .select('id, name, slug, owner_id, onboarding_step')
      .eq('id', staffProfile.store_id)
      .maybeSingle()
    if (store) return { store: store as DashboardStore, role: 'staff' }
  }

  return null
}

/**
 * Versi ter-cache per request dari getDashboardAccess (performa
 * 2026-11-10): layout dashboard dan halaman anak sering sama-sama
 * membutuhkan akses toko dalam satu render — sebelumnya query yang
 * sama (sampai 3 untuk staff) jalan berulang kali. Client dibuat di
 * dalam supaya kunci cache hanya userId.
 */
export const getDashboardAccessCached = cache(
  async (userId: string): Promise<DashboardAccess> => {
    const supabase = await createClient()
    return getDashboardAccess(supabase, userId)
  }
)

// Untuk server action yang hanya boleh dijalankan pemilik toko
// (tambah/hapus staff, pengaturan, langganan).
export async function getOwnerStore(
  supabase: SupabaseClient,
  userId: string
): Promise<DashboardStore | null> {
  const { data: store } = await supabase
    .from('stores')
    .select('id, name, slug, owner_id, onboarding_step')
    .eq('owner_id', userId)
    .maybeSingle()
  return (store as DashboardStore | null) ?? null
}
