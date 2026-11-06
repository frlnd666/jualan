'use server'

import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'

export interface CloudinarySignature {
  signature: string
  timestamp: number
  apiKey: string
  cloudName: string
  folder: string
}

/**
 * Tanda tangan upload Cloudinary dibuat di server dari CLOUDINARY_API_SECRET
 * (tidak pernah dikirim ke browser). Hanya untuk user yang login.
 *
 * Mengembalikan null bila kredensial server belum dikonfigurasi — pemanggil
 * lalu jatuh ke mode preset unsigned lama agar aplikasi tidak rusak sebelum
 * env diset.
 */
export async function getCloudinarySignature(
  folder = 'jualan'
): Promise<CloudinarySignature | null> {
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  const apiKey = process.env.CLOUDINARY_API_KEY
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

  if (!apiSecret || !apiKey || !cloudName) return null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const timestamp = Math.floor(Date.now() / 1000)
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`
  const signature = createHash('sha1')
    .update(paramsToSign + apiSecret)
    .digest('hex')

  return { signature, timestamp, apiKey, cloudName, folder }
}
