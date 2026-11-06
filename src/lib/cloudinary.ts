import { getCloudinarySignature } from '@/lib/actions/cloudinary-sign'

/**
 * Upload gambar ke Cloudinary.
 *
 * Mode utama: signed upload — tanda tangan dibuat server action dari
 * API secret (lihat lib/actions/cloudinary-sign.ts), jadi tidak ada lagi
 * preset unsigned publik yang bisa dipakai orang lain untuk mengunggah
 * ke akun Cloudinary ini.
 *
 * Fallback: bila CLOUDINARY_API_KEY/SECRET belum diset di server, gunakan
 * preset unsigned lama (NEXT_PUBLIC_CLOUDINARY_PRESET) agar fitur tetap
 * jalan selama masa transisi konfigurasi.
 */
export async function uploadToCloudinary(file: File) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const formData = new FormData()
  formData.append('file', file)

  const signed = await getCloudinarySignature('jualan')

  if (signed) {
    formData.append('api_key', signed.apiKey)
    formData.append('timestamp', String(signed.timestamp))
    formData.append('signature', signed.signature)
    formData.append('folder', signed.folder)
  } else {
    formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_PRESET!)
  }

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  )

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error?.message || 'Upload gagal')
  }

  return data.secure_url as string
}
