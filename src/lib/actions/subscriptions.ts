// Server action langganan (Fase 1, rencana SaaS Bab 3–6).
//
// Prinsip keamanan: pemilik toko TIDAK bisa mengubah subscriptions
// sendiri lewat RLS (tidak ada policy update untuk owner) — semua
// perubahan tier/status lewat action di file ini yang memakai
// service_role. Pembayaran langganan hanya bisa DIBUAT pemilik (status
// awal selalu PENDING_VERIFICATION); verifikasi hanya oleh admin.
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPublicInvoiceClient } from '@/lib/invoice-access'
import { getDashboardAccess } from '@/lib/dashboard-access'
import { logAudit } from '@/lib/audit'
import { dispatchNotify } from '@/lib/notify'
import {
  getStoreSubscription,
  periodEndFor,
  allowedCheckoutMethods,
  TIER_PRICES,
  TIER_LABELS,
  type Tier,
} from '@/lib/subscriptions'
import {
  effectiveTier,
  limitsFor,
  TRIAL_DAYS,
  type SubscriptionRow,
} from '@/lib/subscription-tiers'

export type PlanChoice = 'free' | 'silver-trial' | 'gold'

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function matchesImageSignature(bytes: Uint8Array, mime: string) {
  if (mime === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (mime === 'image/png') {
    return (
      bytes.length >= 4 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    )
  }
  if (mime === 'image/webp') {
    const riff = bytes.length >= 4 ? String.fromCharCode(...bytes.slice(0, 4)) : ''
    const webp = bytes.length >= 12 ? String.fromCharCode(...bytes.slice(8, 12)) : ''
    return riff === 'RIFF' && webp === 'WEBP'
  }
  return false
}

async function getOwnedStoreId(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }
  const { data: isAdmin, error } = await supabase.rpc('is_admin')
  if (error || isAdmin !== true) {
    return { error: 'Hanya admin platform yang boleh melakukan ini.' }
  }
  return { user }
}

/**
 * Dipanggil sekali saat toko pertama kali dibuat (dari halaman
 * Pengaturan Toko): membuat baris subscriptions sesuai paket yang
 * dipilih saat register, dan menaikkan peran pemilik jadi seller.
 * Idempotent — bila baris subscriptions sudah ada, tidak ditimpa.
 * Paket 'gold' di sini tetap dibuat sebagai Free; Gold aktif hanya
 * setelah pembayaran manual diverifikasi admin (halaman Langganan).
 */
export async function ensureStoreSubscription(
  storeId: string,
  plan: PlanChoice
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const ownedStoreId = await getOwnedStoreId(user.id)
  if (ownedStoreId !== storeId) {
    return { error: 'Toko tidak ditemukan untuk akun ini.' }
  }

  const admin = createAdminClient()
  if (!admin) {
    return { error: 'Server belum dikonfigurasi (service role belum diset).' }
  }

  const { data: existing } = await admin
    .from('subscriptions')
    .select('id')
    .eq('store_id', storeId)
    .maybeSingle()

  if (!existing) {
    const now = new Date()
    const trialEndsAt =
      plan === 'silver-trial'
        ? new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
        : null
    const { error } = await admin.from('subscriptions').insert({
      store_id: storeId,
      tier: plan === 'silver-trial' ? 'silver' : 'free',
      status: plan === 'silver-trial' ? 'TRIALING' : 'ACTIVE',
      trial_ends_at: trialEndsAt,
      current_period_start: plan === 'silver-trial' ? now.toISOString() : null,
      current_period_end: trialEndsAt,
    })
    if (error) return { error: `Gagal membuat langganan: ${error.message}` }
  }

  // Naikkan peran pemilik jadi seller (service_role melewati penjaga
  // peran di f0_roles; user biasa tidak bisa mengubah perannya sendiri).
  // Admin yang membuat toko TIDAK diturunkan jadi seller.
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if ((profile as { role: string } | null)?.role !== 'admin') {
    const { error: profileError } = await admin
      .from('profiles')
      .upsert({ id: user.id, role: 'seller' }, { onConflict: 'id' })
    if (profileError) {
      return { error: `Toko dibuat, tapi peran gagal diperbarui: ${profileError.message}` }
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/subscription')
  return { success: true }
}

/**
 * Penegakan batas tier DI SERVER untuk tambah produk (Bab 6 rencana:
 * batas ditegakkan di server, bukan hanya disembunyikan di UI).
 * Halaman /dashboard/products/new memanggil action ini, bukan insert
 * langsung dari browser. Ada celah balapan hitung-lalu-sisip bila dua
 * permintaan bersamaan — batas tetap ditegakkan untuk alur normal;
 * penegakan atomik penuh di database adalah pekerjaan lanjutan.
 */
export async function createProductAction(input: {
  name: string
  slug: string
  price: number
  stock: number
  description: string
  images: string[]
  /** Berat per unit (gram, Fase 3) — dipakai hitung ongkir di checkout. */
  weightGram?: number | null
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login untuk menambahkan produk.' }

  // Fase 2: staff toko boleh menambah produk (hak terbatas), pemilik
  // tetap lewat jalur yang sama. Aksi langganan lain di file ini tetap
  // owner-only lewat getOwnedStoreId.
  const access = await getDashboardAccess(supabase, user.id)
  const storeId = access?.store.id
  if (!storeId) return { error: 'Toko tidak ditemukan untuk akun ini.' }

  const name = input.name.trim()
  const slug = input.slug.trim().toLowerCase()
  if (!name) return { error: 'Nama produk wajib diisi.' }
  if (!slug) return { error: 'Slug produk wajib diisi.' }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    return { error: 'Harga produk harus lebih dari 0.' }
  }

  const subscription = await getStoreSubscription(supabase, storeId)
  const limits = limitsFor(subscription)
  const { premiumLocked } = effectiveTier(subscription)

  if (premiumLocked && subscription.tier !== 'free') {
    return {
      error:
        'Langgananmu sedang telat bayar — tambah produk baru dikunci sampai pembayaran diperpanjang.',
    }
  }
  if (input.images.length > limits.maxPhotosPerProduct) {
    return {
      error: `Paketmu hanya mengizinkan ${limits.maxPhotosPerProduct} foto per produk. Upgrade paket untuk menambah foto.`,
    }
  }

  const { count, error: countError } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
  if (countError) return { error: 'Gagal memeriksa jumlah produk.' }
  if ((count ?? 0) >= limits.maxProducts) {
    return {
      error: `Paketmu sudah mencapai batas ${limits.maxProducts} produk. Hapus produk lama atau upgrade paket untuk menambah produk.`,
    }
  }

  const { error } = await supabase.from('products').insert({
    store_id: storeId,
    name,
    slug,
    price: input.price,
    stock: Math.max(0, Math.floor(input.stock) || 0),
    description: input.description.trim(),
    images: input.images.slice(0, limits.maxPhotosPerProduct),
    // Fase 3: berat produk (gram). Kolom sudah ada sejak Fase 0/live;
    // bila insert gagal karena kolom belum ada di instalasi lama,
    // error-nya diteruskan apa adanya (bukan silent) supaya terlihat.
    weight_gram:
      input.weightGram && Number.isFinite(input.weightGram) && input.weightGram > 0
        ? Math.floor(input.weightGram)
        : null,
    available: true,
  })

  if (error) {
    if (error.message?.toLowerCase().includes('duplicate')) {
      return { error: 'Slug produk sudah dipakai. Gunakan slug lain.' }
    }
    return { error: `Gagal menyimpan produk: ${error.message}` }
  }

  revalidatePath('/dashboard/products')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Upload bukti pembayaran langganan ke bucket `payment-proofs` (privat),
 * path subscription/<storeId>/.... Nilai yang dikembalikan adalah URL
 * publik hasil getPublicUrl — sama seperti bukti transfer order — dan
 * dibaca admin lewat signed URL (lihat lib/payment-proof.ts).
 */
export async function uploadSubscriptionProof(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const storeId = await getOwnedStoreId(user.id)
  if (!storeId) return { error: 'Toko tidak ditemukan untuk akun ini.' }

  const file = formData.get('file') as File | null
  if (!file) return { error: 'Pilih file bukti pembayaran dulu.' }

  const ext = EXT_BY_MIME[file.type]
  if (!ext) return { error: 'File harus JPG, PNG, atau WEBP.' }
  if (file.size > 3 * 1024 * 1024) {
    return { error: 'Ukuran file maksimal 3MB.' }
  }
  const headerBytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (!matchesImageSignature(headerBytes, file.type)) {
    return { error: 'Isi file bukan gambar yang valid.' }
  }

  const storage = await createPublicInvoiceClient()
  const objectPath = `subscription/${storeId}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await storage.storage
    .from('payment-proofs')
    .upload(objectPath, file, { cacheControl: '3600', upsert: false })
  if (uploadError) {
    return { error: `Gagal upload bukti: ${uploadError.message}` }
  }

  const { data } = storage.storage
    .from('payment-proofs')
    .getPublicUrl(objectPath)
  return { proofUrl: data.publicUrl }
}

/**
 * Penjual mengajukan perpanjangan/upgrade manual (Bab 6): pilih paket +
 * metode + bukti → baris subscription_payments PENDING_VERIFICATION.
 * Admin yang memverifikasi (lihat verifySubscriptionPayment).
 */
export async function submitSubscriptionPayment(input: {
  tier: Exclude<Tier, 'free'>
  method: 'QRIS' | 'TRANSFER'
  proofUrl: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const storeId = await getOwnedStoreId(user.id)
  if (!storeId) return { error: 'Toko tidak ditemukan untuk akun ini.' }

  if (input.tier !== 'silver' && input.tier !== 'gold') {
    return { error: 'Paket tidak valid.' }
  }
  if (input.method !== 'QRIS' && input.method !== 'TRANSFER') {
    return { error: 'Metode pembayaran tidak valid.' }
  }
  if (!input.proofUrl) {
    return { error: 'Upload bukti pembayaran dulu.' }
  }

  const amount = TIER_PRICES[input.tier]

  // Satu pengajuan pending per toko — cegah antrean ganda untuk paket yang sama.
  const { data: pending } = await supabase
    .from('subscription_payments')
    .select('id')
    .eq('store_id', storeId)
    .eq('status', 'PENDING_VERIFICATION')
    .limit(1)
  if (pending && pending.length > 0) {
    return {
      error:
        'Masih ada pembayaran langganan yang menunggu verifikasi admin. Tunggu hasilnya dulu sebelum mengajukan lagi.',
    }
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('store_id', storeId)
    .maybeSingle()

  const { error } = await supabase.from('subscription_payments').insert({
    store_id: storeId,
    subscription_id: (subscription as { id: string } | null)?.id ?? null,
    tier: input.tier,
    amount,
    method: input.method,
    proof_url: input.proofUrl,
    status: 'PENDING_VERIFICATION',
  })
  if (error) {
    return { error: `Gagal mengajukan pembayaran: ${error.message}` }
  }

  revalidatePath('/dashboard/subscription')
  return { success: true }
}

/**
 * Admin memverifikasi / menolak pembayaran langganan (Bab 6).
 * Verifikasi → pembayaran VERIFIED + subscriptions diperbarui (tier baru,
 * status ACTIVE, periode baru). Penolakan → pembayaran REJECTED saja.
 */
export async function verifySubscriptionPayment(
  paymentId: string,
  decision: 'verify' | 'reject'
) {
  const adminCheck = await requireAdmin()
  if ('error' in adminCheck) return { error: adminCheck.error }
  const adminUser = adminCheck.user

  const admin = createAdminClient()
  if (!admin) {
    return { error: 'Server belum dikonfigurasi (service role belum diset).' }
  }

  const { data: payment, error: paymentError } = await admin
    .from('subscription_payments')
    .select('id, store_id, subscription_id, tier, status')
    .eq('id', paymentId)
    .maybeSingle()
  if (paymentError || !payment) {
    return { error: 'Pembayaran langganan tidak ditemukan.' }
  }
  if ((payment as { status: string }).status !== 'PENDING_VERIFICATION') {
    return { error: 'Pembayaran ini sudah diproses sebelumnya.' }
  }

  const now = new Date()
  const { error: updatePaymentError } = await admin
    .from('subscription_payments')
    .update({
      status: decision === 'verify' ? 'VERIFIED' : 'REJECTED',
      verified_by: adminUser.id,
      verified_at: now.toISOString(),
      ...(decision === 'verify'
        ? {
            period_start: now.toISOString(),
            period_end: periodEndFor(
              (payment as { tier: 'silver' | 'gold' }).tier,
              now
            ).toISOString(),
          }
        : {}),
    })
    .eq('id', paymentId)
  if (updatePaymentError) {
    return { error: `Gagal memproses pembayaran: ${updatePaymentError.message}` }
  }

  if (decision === 'verify') {
    const tier = (payment as { tier: 'silver' | 'gold' }).tier
    const { error: updateSubError } = await admin
      .from('subscriptions')
      .update({
        tier,
        status: 'ACTIVE',
        current_period_start: now.toISOString(),
        current_period_end: periodEndFor(tier, now).toISOString(),
        trial_ends_at: null,
        grace_ends_at: null,
      })
      .eq('store_id', (payment as { store_id: string }).store_id)
    if (updateSubError) {
      return {
        error: `Pembayaran terverifikasi, tapi langganan gagal diperbarui: ${updateSubError.message}`,
      }
    }
  }

  // Fase 4 — audit log (best-effort).
  await logAudit({
    actorId: adminUser.id,
    actorRole: 'admin',
    storeId: (payment as { store_id: string }).store_id,
    action: decision === 'verify' ? 'subscription_verified' : 'subscription_rejected',
    entityType: 'subscription_payment',
    entityId: paymentId,
    details: {
      tier: (payment as { tier: string }).tier,
      payment_id: paymentId,
    },
  })

  // Beri tahu pemilik toko hasil verifikasi: in-app + email + WhatsApp.
  // Fire-and-forget — verifikasi sudah sukses, notifikasi tidak boleh
  // mengubah hasilnya.
  try {
    const { data: store } = await admin
      .from('stores')
      .select('owner_id, name')
      .eq('id', (payment as { store_id: string }).store_id)
      .maybeSingle()
    const storeRow = store as { owner_id: string; name: string } | null
    if (storeRow) {
      const tierLabel =
        TIER_LABELS[(payment as { tier: 'silver' | 'gold' }).tier]
      void dispatchNotify(admin, {
        userId: storeRow.owner_id,
        storeId: (payment as { store_id: string }).store_id,
        type: decision === 'verify' ? 'SUBSCRIPTION_VERIFIED' : 'SUBSCRIPTION_REJECTED',
        title:
          decision === 'verify'
            ? `Pembayaran langganan ${storeRow.name} terverifikasi`
            : `Pembayaran langganan ${storeRow.name} ditolak`,
        body:
          decision === 'verify'
            ? `Paket ${tierLabel} sudah aktif.`
            : 'Periksa bukti pembayaranmu dan ajukan ulang.',
        link: '/dashboard/subscription',
        data: {
          storeName: storeRow.name,
          tier: tierLabel,
          link: '/dashboard/subscription',
        },
        recipient: 'seller',
      })
    }
  } catch {}

  revalidatePath('/dashboard/admin/subscriptions')
  revalidatePath('/dashboard/subscription')
  return { success: true }
}

/**
 * Penjual membatalkan langganannya sendiri (Bab 4):
 * - Batal saat TRIALING → langsung turun ke Free.
 * - Batal saat ACTIVE berbayar → tetap CANCELLED sampai akhir periode
 *   (tier efektif dihitung di lib/subscription-tiers.ts), lalu Free.
 */
export async function cancelSubscription() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Kamu harus login.' }

  const storeId = await getOwnedStoreId(user.id)
  if (!storeId) return { error: 'Toko tidak ditemukan untuk akun ini.' }

  const admin = createAdminClient()
  if (!admin) {
    return { error: 'Server belum dikonfigurasi (service role belum diset).' }
  }

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('tier, status')
    .eq('store_id', storeId)
    .maybeSingle()
  const row = subscription as SubscriptionRow | null
  if (!row || row.tier === 'free') {
    return { error: 'Tokomu sudah memakai paket Free.' }
  }
  if (row.status === 'CANCELLED') {
    return { error: 'Langganan sudah dibatalkan sebelumnya.' }
  }

  if (row.status === 'TRIALING') {
    const { error } = await admin
      .from('subscriptions')
      .update({
        tier: 'free',
        status: 'ACTIVE',
        trial_ends_at: null,
        current_period_start: null,
        current_period_end: null,
      })
      .eq('store_id', storeId)
    if (error) return { error: `Gagal membatalkan: ${error.message}` }
  } else {
    const { error } = await admin
      .from('subscriptions')
      .update({ status: 'CANCELLED' })
      .eq('store_id', storeId)
    if (error) return { error: `Gagal membatalkan: ${error.message}` }
  }

  // Fase 4 — audit log (best-effort).
  await logAudit({
    actorId: user.id,
    actorRole: 'seller',
    storeId,
    action: 'subscription_cancelled',
    entityType: 'subscription',
    entityId: storeId,
    details: { tier: row.tier, from_status: row.status },
  })

  revalidatePath('/dashboard/subscription')
  return { success: true }
}

/** Metode pembayaran yang diizinkan di checkout untuk sebuah toko. */
export async function getAllowedPaymentMethodsAction(storeId: string) {
  if (!storeId) return [] as Array<'BANK_TRANSFER' | 'QRIS' | 'COD'>
  const supabase = await createPublicInvoiceClient()
  const subscription = await getStoreSubscription(supabase, storeId)
  return allowedCheckoutMethods(subscription)
}
