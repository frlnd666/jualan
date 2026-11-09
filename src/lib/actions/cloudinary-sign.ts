'use server'

import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { getDashboardAccess } from '@/lib/dashboard-access'

export interface CloudinarySignature {
  signature: string
  timestamp: number
  apiKey: string
  cloudName: string
  folder: string
}

/**
 * Tanda tangan upload Cloudinary dibuat di server dari CLOUDINARY_API_SECRET
 * (tidak pernah dikirim ke browser).
 *
 * Keamanan (audit 2026-11-09): signature HANYA untuk pemilik/staff toko
 * (getDashboardAccess) — bukan sembarang user login — dan folder TIDAK
 * PERNAH diambil dari client: folder diturunkan dari toko pemanggil
 * (`jualan/stores/<storeId>`) supaya satu toko tidak bisa menulis ke
 * folder toko lain atau folder arbitrer di akun Cloudinary platform.
 * Argumen `folder` lama diabaikan demi kompatibilitas pemanggil.
 *
 * Mengembalikan null bila kredensial server belum dikonfigurasi atau
 * pemanggil tidak punya akses toko — pemanggil lalu jatuh ke mode preset
 * unsigned lama agar aplikasi tidak rusak sebelum env diset.
 */
export async function getCloudinarySignature(
  _folder?: string
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

  const access = await getDashboardAccess(supabase, user.id)
  if (!access) return null

  const folder = `jualan/stores/${access.store.id}`
  const timestamp = Math.floor(Date.now() / 1000)
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`
  const signature = createHash('sha1')
    .update(paramsToSign + apiSecret)
    .digest('hex')

  return { signature, timestamp, apiKey, cloudName, folder }
}
