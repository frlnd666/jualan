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
