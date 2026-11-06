import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Nilai `payment_proof_url` yang tersimpan adalah URL publik hasil
 * `getPublicUrl()`. Setelah bucket `payment-proofs` dibuat privat (migrasi
 * P0), URL publik itu berhenti bekerja. Helper ini mengekstrak path objek
 * dari URL tersimpan lalu menukarnya dengan signed URL berumur pendek.
 *
 * Jika SUPABASE_SERVICE_ROLE_KEY belum diset (admin client null), URL
 * tersimpan dikembalikan apa adanya agar perilaku lama tidak berubah.
 */
export async function resolvePaymentProofUrl(
  storedUrl: string | null | undefined,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!storedUrl) return null

  const admin = createAdminClient()
  if (!admin) return storedUrl

  const marker = '/payment-proofs/'
  const markerIndex = storedUrl.indexOf(marker)
  if (markerIndex === -1) return storedUrl

  const objectPath = decodeURIComponent(
    storedUrl.slice(markerIndex + marker.length).split('?')[0]
  )
  if (!objectPath) return storedUrl

  const { data, error } = await admin.storage
    .from('payment-proofs')
    .createSignedUrl(objectPath, expiresInSeconds)

  if (error || !data?.signedUrl) return storedUrl
  return data.signedUrl
}
