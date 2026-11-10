import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Nilai `payment_proof_url` yang tersimpan adalah URL publik hasil
 * `getPublicUrl()`. Setelah bucket `payment-proofs` dibuat privat (migrasi
 * P0), URL publik itu berhenti bekerja. Helper ini mengekstrak path objek
 * dari URL tersimpan lalu menukarnya dengan signed URL berumur pendek.
 *
 * P2-19: bila service role belum diset atau signing gagal, kembalikan
 * null (bukan URL tersimpan) — URL publik lama itu mati, jadi
 * mengembalikannya hanya menampilkan gambar 403 tanpa penjelasan.
 * Pemanggil menampilkan pesan "bukti tidak bisa dimuat".
 */
export async function resolvePaymentProofUrl(
  storedUrl: string | null | undefined,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!storedUrl) return null

  const admin = createAdminClient()
  if (!admin) {
    console.error(
      '[payment-proof] service role belum diset; bukti pembayaran tidak bisa dimuat.'
    )
    return null
  }

  const marker = '/payment-proofs/'
  const markerIndex = storedUrl.indexOf(marker)
  if (markerIndex === -1) return null

  const objectPath = decodeURIComponent(
    storedUrl.slice(markerIndex + marker.length).split('?')[0]
  )
  if (!objectPath) return null

  const { data, error } = await admin.storage
    .from('payment-proofs')
    .createSignedUrl(objectPath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    console.error(
      '[payment-proof] gagal membuat signed URL:',
      error?.message ?? 'unknown'
    )
    return null
  }
  return data.signedUrl
}

/**
 * Versi batch dari resolvePaymentProofUrl (performa 2026-11-10):
 * halaman admin langganan sebelumnya memanggil versi tunggal dalam
 * loop serial — 20–120 panggilan Storage API berurutan untuk satu
 * halaman. Versi ini SATU panggilan createSignedUrls untuk semua
 * path + satu admin client. Mengembalikan Map dari URL tersimpan →
 * signed URL (atau null bila gagal/tidak valid), urutan bebas.
 */
export async function resolvePaymentProofUrls(
  storedUrls: Array<string | null | undefined>,
  expiresInSeconds = 3600
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>()
  const marker = '/payment-proofs/'
  const pathByUrl = new Map<string, string>()
  for (const storedUrl of storedUrls) {
    if (!storedUrl) continue
    if (result.has(storedUrl)) continue
    const markerIndex = storedUrl.indexOf(marker)
    if (markerIndex === -1) {
      result.set(storedUrl, null)
      continue
    }
    const objectPath = decodeURIComponent(
      storedUrl.slice(markerIndex + marker.length).split('?')[0]
    )
    if (!objectPath) {
      result.set(storedUrl, null)
      continue
    }
    pathByUrl.set(storedUrl, objectPath)
  }
  if (pathByUrl.size === 0) return result

  const admin = createAdminClient()
  if (!admin) {
    console.error(
      '[payment-proof] service role belum diset; bukti pembayaran tidak bisa dimuat.'
    )
    for (const storedUrl of pathByUrl.keys()) result.set(storedUrl, null)
    return result
  }

  const paths = [...new Set(pathByUrl.values())]
  const { data, error } = await admin.storage
    .from('payment-proofs')
    .createSignedUrls(paths, expiresInSeconds)
  if (error || !data) {
    console.error(
      '[payment-proof] gagal membuat signed URL batch:',
      error?.message ?? 'unknown'
    )
    for (const storedUrl of pathByUrl.keys()) result.set(storedUrl, null)
    return result
  }
  const signedByPath = new Map<string, string | null>()
  for (const item of data) {
    signedByPath.set(item.path ?? '', item.signedUrl ?? null)
  }
  for (const [storedUrl, objectPath] of pathByUrl) {
    result.set(storedUrl, signedByPath.get(objectPath) ?? null)
  }
  return result
}
