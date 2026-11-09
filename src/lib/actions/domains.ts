// Domain toko — SERVER ACTIONS (Fase 5).
// - CRUD domain custom: owner-only + tier-gated (Gold saja;
//   TIER_LIMITS.gold.customDomain = true; Free/Silver false).
// - Domain disimpan di tabel store_domains (migrasi f5). Bila
//   VERCEL_API_TOKEN tersedia, domain otomatis didaftarkan ke project
//   Vercel; bila tidak, status tetap 'pending' dan halaman menampilkan
//   instruksi manual (tambah di Vercel Dashboard + pasang DNS).
// - Verifikasi = cek ke Vercel (GET domain + POST verify bila perlu).
//   Tanpa token, verifikasi tidak bisa otomatis — pemilik harus
//   memastikan DNS benar lalu menekan "Cek lagi" setelah menambah
//   domain manual di Vercel Dashboard.

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getOwnerStore, type DashboardStore } from '@/lib/dashboard-access'
import { getStoreSubscription, limitsFor } from '@/lib/subscriptions'
import {
  normalizeDomain,
  validateDomain,
  dnsInstructionsFor,
  platformDomainFromEnv,
  subdomainUrl,
  MAX_DOMAINS_PER_STORE,
  type DnsRecord,
} from '@/lib/domains'
import {
  addDomainToVercel,
  getVercelDomain,
  getVercelDomainConfig,
  removeDomainFromVercel,
  verifyDomainOnVercel,
  getVercelConfig,
} from '@/lib/vercel-domains'
import { logAudit } from '@/lib/audit'

export type DomainStatus = 'pending' | 'verified' | 'failed'

export interface DomainRow {
  id: string
  domain: string
  status: DomainStatus
  vercel_added: boolean
  verified_at: string | null
  created_at: string
  dns: DnsRecord[]
}

export interface DomainsPageData {
  storeSlug: string
  tier: string
  tierLabel: string
  customDomainAllowed: boolean
  platformDomain: string | null
  subdomainUrl: string | null
  wildcardAdded: boolean | null
  vercelTokenConfigured: boolean
  domains: DomainRow[]
  loadError: string | null
}

async function requireOwnerStore(): Promise<
  | { supabase: SupabaseClient; store: DashboardStore }
  | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' as const }
  const store = await getOwnerStore(supabase, user.id)
  if (!store) return { error: 'Toko tidak ditemukan untuk akun ini.' as const }
  return { supabase, store }
}

async function dnsForDomain(domain: string): Promise<DnsRecord[]> {
  const config = await getVercelDomainConfig(domain)
  const cname = config.ok ? config.data.cnames[0] ?? null : null
  return dnsInstructionsFor(domain, cname)
}

async function wildcardStatus(
  platformDomain: string | null
): Promise<boolean | null> {
  if (!platformDomain || !getVercelConfig()) return null
  const result = await getVercelDomain(`*.${platformDomain}`)
  if (!result.ok) return null
  return true
}

export async function getDomainsPageDataAction(): Promise<DomainsPageData> {
  const owner = await requireOwnerStore()
  const platformDomain = platformDomainFromEnv(
    process.env.NEXT_PUBLIC_PLATFORM_DOMAIN
  )
  const empty: DomainsPageData = {
    storeSlug: owner && 'store' in owner ? owner.store.slug : '',
    tier: 'free',
    tierLabel: 'Free',
    customDomainAllowed: false,
    platformDomain,
    subdomainUrl: null,
    wildcardAdded: null,
    vercelTokenConfigured: getVercelConfig() !== null,
    domains: [],
    loadError: 'error' in owner ? owner.error : null,
  }
  if ('error' in owner) return empty
  const { supabase, store } = owner

  // R-03: gagal baca langganan = fail-closed, terlihat oleh seller lewat
  // loadError (fungsi ini mengembalikan DomainsPageData, bukan { error }).
  let subscription
  try {
    subscription = await getStoreSubscription(supabase, store.id)
  } catch {
    return {
      ...empty,
      storeSlug: store.slug,
      loadError: 'Gagal memeriksa langganan toko. Coba lagi.',
    }
  }
  const limits = limitsFor(subscription)
  const customDomainAllowed =
    limits.customDomain && subscription.status !== 'PAST_DUE'

  const data: DomainsPageData = {
    ...empty,
    storeSlug: store.slug,
    tier: subscription.tier,
    tierLabel: subscription.tier === 'gold' ? 'Gold' : subscription.tier === 'silver' ? 'Silver' : 'Free',
    customDomainAllowed,
    subdomainUrl: subdomainUrl(store.slug, platformDomain),
    wildcardAdded: await wildcardStatus(platformDomain),
    loadError: null,
  }

  const { data: rows, error } = await supabase
    .from('store_domains')
    .select('id, domain, status, vercel_added, verified_at, created_at')
    .eq('store_id', store.id)
    .order('created_at', { ascending: true })
  if (error) {
    // Tabel belum ada (migrasi f5 belum dijalankan) — bukan crash.
    data.loadError = 'Domain belum tersedia — jalankan migrasi Fase 5 dulu.'
    return data
  }
  const list = (rows ?? []) as Array<{
    id: string
    domain: string
    status: DomainStatus
    vercel_added: boolean
    verified_at: string | null
    created_at: string
  }>
  data.domains = await Promise.all(
    list.map(async (row) => ({
      ...row,
      dns: await dnsForDomain(row.domain),
    }))
  )
  return data
}

export async function addDomainAction(
  formData: FormData
): Promise<{ success?: string; error?: string }> {
  const owner = await requireOwnerStore()
  if ('error' in owner) return { error: owner.error }
  const { supabase, store } = owner

  // R-03: gagal baca langganan = fail-closed, terlihat oleh seller.
  let subscription
  try {
    subscription = await getStoreSubscription(supabase, store.id)
  } catch {
    return { error: 'Gagal memeriksa langganan toko. Coba lagi.' }
  }
  const limits = limitsFor(subscription)
  if (!limits.customDomain || subscription.status === 'PAST_DUE') {
    return {
      error:
        'Domain sendiri hanya untuk paket Gold. Upgrade paketmu di halaman Langganan untuk memakai fitur ini.',
    }
  }

  const rawDomain = String(formData.get('domain') ?? '')
  const domain = normalizeDomain(rawDomain)
  const validationError = validateDomain(rawDomain)
  if (validationError) return { error: validationError }
  const platformDomain = platformDomainFromEnv(
    process.env.NEXT_PUBLIC_PLATFORM_DOMAIN
  )
  if (platformDomain && (domain === platformDomain || domain.endsWith(`.${platformDomain}`))) {
    return {
      error:
        'Domain ini bagian dari domain platform — pakai subdomain toko di atas, bukan tambah manual di sini.',
    }
  }

  const { data: existing } = await supabase
    .from('store_domains')
    .select('id, store_id')
    .eq('domain', domain)
    .maybeSingle()
  if (existing) {
    const mine = (existing as { store_id: string }).store_id === store.id
    return {
      error: mine
        ? 'Domain ini sudah terdaftar di tokomu.'
        : 'Domain ini sudah dipakai toko lain.',
    }
  }

  const { count } = await supabase
    .from('store_domains')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', store.id)
  if ((count ?? 0) >= MAX_DOMAINS_PER_STORE) {
    return { error: `Maksimal ${MAX_DOMAINS_PER_STORE} domain per toko.` }
  }

  // Daftarkan ke Vercel bila token tersedia; gagal/tanpa token = tetap
  // simpan sebagai pending + instruksi manual (bukan error).
  const vercelResult = await addDomainToVercel(domain)
  const vercelAdded = vercelResult.ok

  const { data: inserted, error: insertError } = await supabase
    .from('store_domains')
    .insert({
      store_id: store.id,
      domain,
      status: 'pending',
      vercel_added: vercelAdded,
    })
    .select('id')
    .single()
  if (insertError) {
    if (String(insertError.code) === '23505') {
      return { error: 'Domain ini sudah terdaftar.' }
    }
    if (String(insertError.message ?? '').includes('store_domains')) {
      return { error: 'Domain belum tersedia — jalankan migrasi Fase 5 dulu.' }
    }
    return { error: 'Gagal menyimpan domain. Coba lagi.' }
  }

  await logAudit({
    actorId: (await supabase.auth.getUser()).data.user?.id ?? null,
    actorRole: 'seller',
    storeId: store.id,
    action: 'domain_added',
    entityType: 'store_domain',
    entityId: (inserted as { id: string } | null)?.id ?? null,
    details: { domain, vercel_added: vercelAdded },
  })

  revalidatePath('/dashboard/domains')
  if (vercelAdded) {
    return {
      success:
        'Domain ditambahkan ke Vercel. Pasang DNS di bawah ini, lalu tekan "Cek verifikasi".',
    }
  }
  return {
    success:
      'Domain tersimpan (pending). Token Vercel belum dipasang — tambahkan domain ini manual di Vercel Dashboard → Settings → Domains, pasang DNS di bawah, lalu tekan "Cek verifikasi".',
  }
}

export async function verifyDomainAction(
  domain: string
): Promise<{ success?: string; error?: string }> {
  const owner = await requireOwnerStore()
  if ('error' in owner) return { error: owner.error }
  const { supabase, store } = owner

  const normalized = normalizeDomain(domain)
  const { data: row } = await supabase
    .from('store_domains')
    .select('id, domain, status')
    .eq('store_id', store.id)
    .eq('domain', normalized)
    .maybeSingle()
  if (!row) return { error: 'Domain tidak ditemukan di tokomu.' }

  if (!getVercelConfig()) {
    return {
      error:
        'Verifikasi otomatis butuh VERCEL_API_TOKEN (belum dipasang). Pastikan domain sudah ditambahkan manual di Vercel Dashboard dan DNS sudah benar, lalu hubungi admin — status akan diperbarui manual.',
    }
  }

  // Minta Vercel memeriksa ulang DNS, lalu baca statusnya.
  await verifyDomainOnVercel(normalized)
  const statusResult = await getVercelDomain(normalized)
  if (!statusResult.ok) {
    await supabase
      .from('store_domains')
      .update({ status: 'failed', last_checked_at: new Date().toISOString() })
      .eq('id', (row as { id: string }).id)
    revalidatePath('/dashboard/domains')
    return { error: `Gagal memeriksa ke Vercel: ${statusResult.message}` }
  }

  const verified = statusResult.data.verified === true
  await supabase
    .from('store_domains')
    .update({
      status: verified ? 'verified' : 'pending',
      verified_at: verified ? new Date().toISOString() : null,
      last_checked_at: new Date().toISOString(),
    })
    .eq('id', (row as { id: string }).id)

  if (verified) {
    await logAudit({
      actorId: (await supabase.auth.getUser()).data.user?.id ?? null,
      actorRole: 'seller',
      storeId: store.id,
      action: 'domain_verified',
      entityType: 'store_domain',
      entityId: (row as { id: string }).id,
      details: { domain: normalized },
    })
    revalidatePath('/dashboard/domains')
    return { success: `Domain ${normalized} terverifikasi — tokomu sudah bisa dibuka lewat domain itu.` }
  }
  revalidatePath('/dashboard/domains')
  return {
    error:
      'DNS belum terdeteksi Vercel. Periksa record di bawah ini sudah benar di registrar, tunggu propagasi (biasanya 1–10 menit), lalu tekan "Cek verifikasi" lagi.',
  }
}

export async function removeDomainAction(
  domain: string
): Promise<{ success?: string; error?: string }> {
  const owner = await requireOwnerStore()
  if ('error' in owner) return { error: owner.error }
  const { supabase, store } = owner

  const normalized = normalizeDomain(domain)
  const { data: row } = await supabase
    .from('store_domains')
    .select('id')
    .eq('store_id', store.id)
    .eq('domain', normalized)
    .maybeSingle()
  if (!row) return { error: 'Domain tidak ditemukan di tokomu.' }

  // Hapus dari Vercel bila token ada (best-effort — gagal di sini tidak
  // menghalangi hapus baris lokal).
  await removeDomainFromVercel(normalized)

  const { error } = await supabase
    .from('store_domains')
    .delete()
    .eq('id', (row as { id: string }).id)
  if (error) return { error: 'Gagal menghapus domain. Coba lagi.' }

  await logAudit({
    actorId: (await supabase.auth.getUser()).data.user?.id ?? null,
    actorRole: 'seller',
    storeId: store.id,
    action: 'domain_removed',
    entityType: 'store_domain',
    entityId: (row as { id: string }).id,
    details: { domain: normalized },
  })

  revalidatePath('/dashboard/domains')
  return { success: `Domain ${normalized} dihapus.` }
}
