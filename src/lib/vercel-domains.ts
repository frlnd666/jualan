// Klien Vercel Domains API — SERVER-ONLY (Fase 5).
// Dipakai server action domain: daftarkan domain ke project Vercel,
// cek status verifikasi, dan baca konfigurasi DNS yang benar.
// Token dari env VERCEL_API_TOKEN — JANGAN pernah hardcode atau kirim
// ke browser. Bila token belum ada, semua fungsi mengembalikan
// { ok: false, reason: 'no_token' } supaya pemanggil jatuh ke alur
// manual (Ferlan tambah domain sendiri di Vercel Dashboard).
//
// Endpoint (dokumen Vercel Domains API):
// - Tambah domain:    POST /v9/projects/{projectId}/domains {name}
// - Status domain:    GET  /v9/projects/{projectId}/domains/{domain}
// - Minta verifikasi: POST /v9/projects/{projectId}/domains/{domain}/verify
// - Konfigurasi DNS:  GET  /v6/domains/{domain}/config
//                      (cnames[0] = CNAME khusus proyek, aValues[0] = IP apex)
// - Hapus domain:     DELETE /v9/projects/{projectId}/domains/{domain}
// Catatan: CNAME generik cname.vercel-dns.com berlaku umum, tapi Vercel
// kadang memberi CNAME khusus proyek — yang dari /config itulah yang
// ditampilkan bila tersedia.

/** Project Vercel "jualin" — bukan secret, boleh fallback ke nilai ini. */
export const DEFAULT_VERCEL_PROJECT_ID = 'prj_N19xmVADtzl3Dvcnvoup2DW4L4s0'

const VERCEL_API_BASE = 'https://api.vercel.com'

export interface VercelConfig {
  token: string
  projectId: string
}

/** Konfigurasi Vercel dari env; null bila token belum diset. */
export function getVercelConfig(): VercelConfig | null {
  const token = (process.env.VERCEL_API_TOKEN ?? '').trim()
  if (!token) return null
  const projectId = (process.env.VERCEL_PROJECT_ID ?? '').trim() || DEFAULT_VERCEL_PROJECT_ID
  return { token, projectId }
}

export type VercelResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'no_token' | 'api_error'; message: string }

async function vercelFetch<T>(
  config: VercelConfig,
  path: string,
  init?: RequestInit
): Promise<VercelResult<T>> {
  let response: Response
  try {
    response = await fetch(`${VERCEL_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    return { ok: false, reason: 'api_error', message: 'Tidak bisa menghubungi api.vercel.com.' }
  }
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  if (!response.ok) {
    const message =
      (body as { error?: { message?: string } } | null)?.error?.message ??
      `Vercel API error ${response.status}.`
    return { ok: false, reason: 'api_error', message }
  }
  return { ok: true, data: body as T }
}

export interface VercelDomainInfo {
  name: string
  verified: boolean
  verification?: Array<{ type: string; domain: string; value: string; reason: string }>
}

/** Daftarkan domain ke project. 409 = sudah terdaftar (dianggap sukses). */
export async function addDomainToVercel(
  domain: string
): Promise<VercelResult<VercelDomainInfo>> {
  const config = getVercelConfig()
  if (!config) {
    return { ok: false, reason: 'no_token', message: 'VERCEL_API_TOKEN belum diset.' }
  }
  const result = await vercelFetch<VercelDomainInfo>(
    config,
    `/v9/projects/${config.projectId}/domains`,
    { method: 'POST', body: JSON.stringify({ name: domain }) }
  )
  if (
    !result.ok &&
    (result.message.includes('409') || /already/i.test(result.message))
  ) {
    return { ok: true, data: { name: domain, verified: false } }
  }
  return result
}

/** Status domain di project (termasuk flag verified dari Vercel). */
export async function getVercelDomain(
  domain: string
): Promise<VercelResult<VercelDomainInfo>> {
  const config = getVercelConfig()
  if (!config) {
    return { ok: false, reason: 'no_token', message: 'VERCEL_API_TOKEN belum diset.' }
  }
  return vercelFetch<VercelDomainInfo>(
    config,
    `/v9/projects/${config.projectId}/domains/${encodeURIComponent(domain)}`
  )
}

/** Minta Vercel memeriksa ulang DNS domain ini. */
export async function verifyDomainOnVercel(
  domain: string
): Promise<VercelResult<VercelDomainInfo>> {
  const config = getVercelConfig()
  if (!config) {
    return { ok: false, reason: 'no_token', message: 'VERCEL_API_TOKEN belum diset.' }
  }
  return vercelFetch<VercelDomainInfo>(
    config,
    `/v9/projects/${config.projectId}/domains/${encodeURIComponent(domain)}/verify`,
    { method: 'POST' }
  )
}

/** Hapus domain dari project (best-effort — gagal di sini tidak fatal). */
export async function removeDomainFromVercel(
  domain: string
): Promise<VercelResult<unknown>> {
  const config = getVercelConfig()
  if (!config) {
    return { ok: false, reason: 'no_token', message: 'VERCEL_API_TOKEN belum diset.' }
  }
  return vercelFetch<unknown>(
    config,
    `/v9/projects/${config.projectId}/domains/${encodeURIComponent(domain)}`,
    { method: 'DELETE' }
  )
}

export interface VercelDomainConfig {
  cnames: string[]
  aValues: string[]
  misconfigured: boolean
}

/** Konfigurasi DNS yang benar menurut Vercel (CNAME khusus proyek dll). */
export async function getVercelDomainConfig(
  domain: string
): Promise<VercelResult<VercelDomainConfig>> {
  const config = getVercelConfig()
  if (!config) {
    return { ok: false, reason: 'no_token', message: 'VERCEL_API_TOKEN belum diset.' }
  }
  return vercelFetch<VercelDomainConfig>(
    config,
    `/v6/domains/${encodeURIComponent(domain)}/config`
  )
}
