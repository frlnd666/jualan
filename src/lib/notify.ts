// Dispatcher notifikasi terpusat CUAN (email + WhatsApp + in-app).
//
// SATU PANGGILAN untuk semua event: dispatchNotify() menulis notifikasi
// in-app (pakai notifyUser yang sudah ada, Fase 3) + mengirim email
// (Resend) + WhatsApp (Meta Cloud API) sesuai preferensi penerima.
//
// ATURAN KERAS — jangan dilanggar pemanggil mana pun:
// - Pengiriman TIDAK BOLEH memperlambat atau menggagalkan request utama
//   (checkout / pembayaran / webhook). Pemanggil di alur panas memakai
//   `void dispatchNotify(...)` (fire-and-forget); cron yang memang
//   background boleh `await`. Fungsi ini TIDAK PERNAH melempar.
// - Kegagalan satu channel hanya dicatat ke observability (logEvent
//   'notify_dispatch') — channel lain tetap jalan, in-app tetap jalan.
// - Bila provider belum dikonfigurasi (RESEND_API_KEY / token WA kosong),
//   channel itu dilewati diam-diam (status 'skipped', bukan error).
// - Bila nomor WA penerima kosong → WA dilewati. Bila email tidak ada
//   (mis. pembeli tamu) → email dilewati, WA tetap bisa jalan lewat
//   nomor HP dari order.
//
// Rute nomor WA penerima (fallback berurutan):
//   1. nomor yang diberikan pemanggil (mis. customer_phone dari order),
//   2. whatsapp_number di notification_preferences,
//   3. alamat terakhir pembeli (buyer_addresses.phone),
//   4. nomor HP di order terakhir pembeli (orders.customer_phone),
//   5. nomor WhatsApp toko (stores.whatsapp) — untuk pemilik toko.
// Email penerima: dari auth.users (lewat service_role) atau yang
// diberikan pemanggil. profiles TIDAK punya kolom email/nomor HP.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  notifyUser,
  notifyOrderStatusChange,
  buyerStatusMessage,
  sellerStatusMessage,
  type NotificationType,
  type OrderParty,
} from '@/lib/notifications'
import { sendEmail, isEmailConfigured, type EmailSender } from '@/lib/email-resend'
import {
  sendWhatsAppMessage,
  isWhatsAppConfigured,
  normalizeWhatsAppNumber,
} from '@/lib/whatsapp'
import { logEvent } from '@/lib/observability'

export type { NotificationType }

export type NotifyChannel = 'email' | 'whatsapp'

export interface NotifyData {
  storeName?: string
  /** Nomor invoice (mis. INV-20261109-XXXX) — tampil di email/WA. */
  orderNumber?: string
  customerName?: string
  total?: number
  trackingNumber?: string | null
  courier?: string | null
  /** Label tier, mis. 'Silver' / 'Gold'. */
  tier?: string
  /** Sisa hari untuk pengingat langganan (3 atau 1). */
  daysLeft?: number
  /** Path relatif tujuan (mis. /dashboard/orders/<id>). */
  link?: string | null
}

export interface DispatchInput {
  /** Penerima yang punya akun. Null = tamu (hanya email/phone override). */
  userId?: string | null
  /** Override email (mis. email staff yang sudah diketahui). */
  email?: string | null
  /** Override nomor WA (mis. customer_phone dari order tamu). */
  phone?: string | null
  storeId?: string | null
  orderId?: string | null
  type: NotificationType
  title: string
  body?: string
  link?: string | null
  data?: NotifyData
  /** Tulis in-app juga (default true; false bila in-app sudah ditulis pemanggil). */
  inApp?: boolean
  /** Default ['email', 'whatsapp']. */
  channels?: NotifyChannel[]
  /** Pihak penerima — menentukan isi email/WA (default 'buyer'). */
  recipient?: 'buyer' | 'seller'
}

export type ChannelStatus = 'sent' | 'skipped' | 'failed'

export interface ChannelResult {
  status: ChannelStatus
  detail?: string
}

export interface DispatchResult {
  inApp: boolean
  email: ChannelResult
  whatsapp: ChannelResult
}

export interface DispatchDeps {
  emailSender?: EmailSender
  whatsappFetch?: typeof fetch
}

// ---------------------------------------------------------------------------
// Preferensi penerima
// ---------------------------------------------------------------------------

export interface NotificationPreferences {
  emailEnabled: boolean
  whatsappEnabled: boolean
  whatsappNumber: string | null
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailEnabled: true,
  whatsappEnabled: true,
  whatsappNumber: null,
}

/**
 * Baca preferensi satu user. Bila tabel belum ada (migrasi belum
 * dijalankan) atau belum ada barisnya → default (semua aktif).
 * Tidak pernah melempar.
 */
export async function getNotificationPreferences(
  client: SupabaseClient,
  userId: string
): Promise<NotificationPreferences> {
  try {
    const { data, error } = await client
      .from('notification_preferences')
      .select('email_enabled, whatsapp_enabled, whatsapp_number')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return { ...DEFAULT_NOTIFICATION_PREFERENCES }
    const row = data as {
      email_enabled?: boolean | null
      whatsapp_enabled?: boolean | null
      whatsapp_number?: string | null
    }
    return {
      emailEnabled: row.email_enabled ?? true,
      whatsappEnabled: row.whatsapp_enabled ?? true,
      whatsappNumber: row.whatsapp_number ?? null,
    }
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES }
  }
}

// ---------------------------------------------------------------------------
// Helper format
// ---------------------------------------------------------------------------

export function formatRupiah(amount: number): string {
  return `Rp${Number(amount || 0).toLocaleString('id-ID')}`
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL || 'https://cuan.is-a.web.id'
  ).replace(/\/$/, '')
}

// ---------------------------------------------------------------------------
// Template email (HTML sederhana, tanpa React Email — template string biasa)
// ---------------------------------------------------------------------------

export interface EmailContent {
  subject: string
  html: string
}

function emailShell(title: string, lines: string[], cta?: { label: string; href: string }): string {
  const body = lines.map((l) => `<p style="margin:0 0 12px;line-height:1.6">${l}</p>`).join('')
  const button = cta
    ? `<p style="margin:20px 0"><a href="${escapeHtml(cta.href)}" style="display:inline-block;background:#0b6b4a;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">${escapeHtml(cta.label)}</a></p>`
    : ''
  return `<!doctype html><html lang="id"><body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f1a17;background:#faf7f2;padding:24px"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8e0d5;border-radius:16px;padding:24px"><h1 style="margin:0 0 16px;font-size:20px;color:#0b6b4a">CUAN</h1><h2 style="margin:0 0 16px;font-size:17px">${escapeHtml(title)}</h2>${body}${button}<p style="margin:24px 0 0;font-size:12px;color:#8a7f74;line-height:1.6">Email otomatis dari CUAN — jangan dibalas. Atur notifikasi email &amp; WhatsApp di halaman Notifikasi akunmu.</p></div></body></html>`
}

/**
 * Subjek + HTML per jenis event dan pihak. Murni (tidak menyentuh DB/
 * network) supaya gampang dites. QRIS_PAID memakai konten ORDER_PAID.
 */
export function buildEmailContent(
  type: NotificationType,
  data: NotifyData,
  recipient: 'buyer' | 'seller'
): EmailContent {
  const store = data.storeName ?? 'toko'
  const orderNo = data.orderNumber ?? ''
  const total = data.total !== undefined ? formatRupiah(data.total) : ''
  const link = data.link ?? null
  const abs = (path: string) => `${siteUrl()}${path}`

  switch (type) {
    case 'ORDER_CREATED':
      return {
        subject: `Pesanan baru di ${store} — ${orderNo}`,
        html: emailShell(`Pesanan baru dari ${data.customerName ?? 'customer'}`, [
          `Ada pesanan baru di <b>${escapeHtml(store)}</b> (${escapeHtml(orderNo)}) dari <b>${escapeHtml(data.customerName ?? 'customer')}</b> dengan total <b>${escapeHtml(total)}</b>.`,
          'Periksa pembayaran dan siapkan pesanannya.',
        ], link ? { label: 'Buka pesanan', href: abs(link) } : undefined),
      }
    case 'ORDER_PAID':
    case 'QRIS_PAID':
    case 'PAYMENT_VERIFIED':
      if (recipient === 'buyer') {
        return {
          subject: `Pembayaranmu di ${store} terkonfirmasi`,
          html: emailShell(`Pembayaranmu di ${store} terkonfirmasi`, [
            `Pesanan <b>${escapeHtml(orderNo)}</b> (${escapeHtml(total)}) sudah dibayar dan sedang disiapkan penjual.`,
          ], link ? { label: 'Lihat pesanan', href: abs(link) } : undefined),
        }
      }
      return {
        subject: `Pembayaran ${data.customerName ?? 'customer'} terkonfirmasi — ${orderNo}`,
        html: emailShell(`Pembayaran ${data.customerName ?? 'customer'} terkonfirmasi`, [
          `Pesanan <b>${escapeHtml(orderNo)}</b> (${escapeHtml(total)}) sudah dibayar. Pesanan siap diproses dan dikirim.`,
        ], link ? { label: 'Buka pesanan', href: abs(link) } : undefined),
      }
    case 'PAYMENT_PROOF_UPLOADED':
      return {
        subject: `Bukti bayar baru — ${orderNo} (${store})`,
        html: emailShell(`Bukti bayar baru dari ${data.customerName ?? 'customer'}`, [
          `Customer <b>${escapeHtml(data.customerName ?? 'customer')}</b> mengunggah bukti transfer untuk pesanan <b>${escapeHtml(orderNo)}</b> (${escapeHtml(total)}).`,
          'Periksa buktinya, lalu konfirmasi pembayaran bila sudah sesuai.',
        ], link ? { label: 'Buka pesanan', href: abs(link) } : undefined),
      }
    case 'ORDER_SHIPPED':
      return {
        subject: `Pesananmu dari ${store} dikirim — resi ${data.trackingNumber ?? ''}`,
        html: emailShell(`Pesananmu dari ${store} dikirim`, [
          `Pesanan <b>${escapeHtml(orderNo)}</b> sudah dikirim${data.courier ? ` via <b>${escapeHtml(data.courier)}</b>` : ''}.`,
          data.trackingNumber
            ? `Nomor resi: <b>${escapeHtml(data.trackingNumber)}</b>. Lacak di halaman pesananmu.`
            : 'Nomor resi tersedia di halaman pesananmu.',
        ], link ? { label: 'Lacak pesanan', href: abs(link) } : undefined),
      }
    case 'ORDER_COMPLETED':
      return {
        subject: `Pesananmu dari ${store} selesai`,
        html: emailShell(`Pesananmu dari ${store} selesai`, [
          `Pesanan <b>${escapeHtml(orderNo)}</b> sudah selesai. Terima kasih sudah berbelanja di <b>${escapeHtml(store)}</b>!`,
        ], link ? { label: 'Lihat pesanan', href: abs(link) } : undefined),
      }
    case 'ORDER_CANCELLED':
      if (recipient === 'buyer') {
        return {
          subject: `Pesananmu di ${store} dibatalkan`,
          html: emailShell(`Pesananmu di ${store} dibatalkan`, [
            `Pesanan <b>${escapeHtml(orderNo)}</b> (${escapeHtml(total)}) dibatalkan. Hubungi penjual bila kamu merasa ini keliru.`,
          ], link ? { label: 'Lihat pesanan', href: abs(link) } : undefined),
        }
      }
      return {
        subject: `Pesanan ${data.customerName ?? 'customer'} dibatalkan — ${orderNo}`,
        html: emailShell(`Pesanan ${data.customerName ?? 'customer'} dibatalkan`, [
          `Pesanan <b>${escapeHtml(orderNo)}</b> (${escapeHtml(total)}) dibatalkan. Stok produk sudah dikembalikan.`,
        ], link ? { label: 'Buka pesanan', href: abs(link) } : undefined),
      }
    case 'TRIAL_ENDING_SOON':
    case 'SUBSCRIPTION_ENDING_SOON': {
      const when = data.daysLeft === 1 ? 'besok' : `${data.daysLeft ?? ''} hari lagi`.trim()
      return {
        subject: `Langganan ${store} berakhir ${when}`,
        html: emailShell(`Langganan ${store} berakhir ${when}`, [
          `Langganan ${data.tier ? `<b>${escapeHtml(data.tier)}</b> ` : ''}tokomu <b>${escapeHtml(store)}</b> berakhir ${escapeHtml(when)}.`,
          'Perpanjang sebelum tanggal berakhir supaya fitur premium tetap aktif.',
        ], { label: 'Buka Langganan', href: abs('/dashboard/subscription') }),
      }
    }
    case 'TRIAL_ENDED':
    case 'SUBSCRIPTION_PAST_DUE':
    case 'SUBSCRIPTION_EXPIRED':
    case 'SUBSCRIPTION_ENDED': {
      const what =
        type === 'TRIAL_ENDED'
          ? 'Masa percobaan berakhir — toko sekarang memakai paket Free.'
          : type === 'SUBSCRIPTION_PAST_DUE'
            ? 'Pembayaran telat — masa tenggang 7 hari. Toko tetap bisa jualan, tapi fitur premium baru terkunci.'
            : 'Langganan berakhir — toko turun ke paket Free. Produk di atas batas disembunyikan (tidak dihapus).'
      return {
        subject: `Langganan ${store}: ${type === 'SUBSCRIPTION_PAST_DUE' ? 'pembayaran telat' : 'berakhir'}`,
        html: emailShell(`Langganan ${store}`, [escapeHtml(what)], {
          label: 'Buka Langganan',
          href: abs('/dashboard/subscription'),
        }),
      }
    }
    case 'SUBSCRIPTION_VERIFIED':
      return {
        subject: `Pembayaran langganan ${store} terverifikasi`,
        html: emailShell(`Pembayaran langganan ${store} terverifikasi`, [
          `Pembayaran langganan ${data.tier ? `<b>${escapeHtml(data.tier)}</b> ` : ''}tokomu sudah diverifikasi admin. Paket berbayarmu sudah aktif.`,
        ], { label: 'Buka Langganan', href: abs('/dashboard/subscription') }),
      }
    case 'SUBSCRIPTION_REJECTED':
      return {
        subject: `Pembayaran langganan ${store} ditolak`,
        html: emailShell(`Pembayaran langganan ${store} ditolak`, [
          `Pembayaran langganan ${data.tier ? `<b>${escapeHtml(data.tier)}</b> ` : ''}tokomu ditolak admin. Periksa bukti pembayaranmu dan ajukan ulang dari halaman Langganan.`,
        ], { label: 'Buka Langganan', href: abs('/dashboard/subscription') }),
      }
    case 'STAFF_ADDED':
      return {
        subject: `Kamu jadi staff ${store} di CUAN`,
        html: emailShell(`Kamu jadi staff ${store}`, [
          `Pemilik toko <b>${escapeHtml(store)}</b> menambahkanmu sebagai staff. Kamu sekarang bisa mengelola produk dan pesanan toko itu dari dashboard.`,
        ], { label: 'Buka dashboard', href: abs('/dashboard') }),
      }
    default:
      return {
        subject: `Notifikasi CUAN — ${store}`,
        html: emailShell('Notifikasi CUAN', [`Ada kabar baru dari toko <b>${escapeHtml(store)}</b>.`], link ? { label: 'Buka', href: abs(link) } : undefined),
      }
  }
}

// ---------------------------------------------------------------------------
// Template WhatsApp (nama dari env, default jelas)
// ---------------------------------------------------------------------------

/**
 * Nama template utility di Meta per jenis event. Diubah lewat env bila
 * nama template yang disetujui Meta berbeda — default di bawah ini yang
 * harus dibuat di Meta (lihat supabase/README.md). Parameter body
 * {{1}}..{{n}} harus cocok urutannya dengan buildWhatsAppTemplateParams.
 */
export function whatsappTemplateName(
  type: NotificationType,
  env: NodeJS.ProcessEnv = process.env
): string {
  switch (type) {
    case 'ORDER_CREATED':
      return env.WHATSAPP_TEMPLATE_ORDER_CREATED || 'cuan_order_created'
    case 'ORDER_PAID':
    case 'QRIS_PAID':
    case 'PAYMENT_VERIFIED':
      return env.WHATSAPP_TEMPLATE_ORDER_PAID || 'cuan_order_paid'
    case 'PAYMENT_PROOF_UPLOADED':
      return env.WHATSAPP_TEMPLATE_PAYMENT_PROOF || 'cuan_payment_proof'
    case 'ORDER_SHIPPED':
      return env.WHATSAPP_TEMPLATE_ORDER_SHIPPED || 'cuan_order_shipped'
    case 'ORDER_COMPLETED':
      return env.WHATSAPP_TEMPLATE_ORDER_COMPLETED || 'cuan_order_completed'
    case 'ORDER_CANCELLED':
      return env.WHATSAPP_TEMPLATE_ORDER_CANCELLED || 'cuan_order_cancelled'
    case 'TRIAL_ENDING_SOON':
    case 'SUBSCRIPTION_ENDING_SOON':
      return env.WHATSAPP_TEMPLATE_SUBSCRIPTION_REMINDER || 'cuan_subscription_reminder'
    case 'TRIAL_ENDED':
    case 'SUBSCRIPTION_PAST_DUE':
    case 'SUBSCRIPTION_EXPIRED':
    case 'SUBSCRIPTION_ENDED':
      return env.WHATSAPP_TEMPLATE_SUBSCRIPTION_UPDATE || 'cuan_subscription_update'
    case 'SUBSCRIPTION_VERIFIED':
      return env.WHATSAPP_TEMPLATE_SUBSCRIPTION_VERIFIED || 'cuan_subscription_verified'
    case 'SUBSCRIPTION_REJECTED':
      return env.WHATSAPP_TEMPLATE_SUBSCRIPTION_REJECTED || 'cuan_subscription_rejected'
    case 'STAFF_ADDED':
      return env.WHATSAPP_TEMPLATE_STAFF_ADDED || 'cuan_staff_added'
    default:
      return env.WHATSAPP_TEMPLATE_DEFAULT || 'cuan_notification'
  }
}

/**
 * Parameter body template ({{1}}, {{2}}, ...) per jenis event dan pihak.
 * Murni — urutan di sini WAJIB sama dengan urutan parameter di template
 * yang dibuat di Meta.
 */
export function buildWhatsAppTemplateParams(
  type: NotificationType,
  data: NotifyData,
  recipient: 'buyer' | 'seller'
): string[] {
  const store = data.storeName ?? 'toko'
  const orderNo = data.orderNumber ?? ''
  const total = data.total !== undefined ? formatRupiah(data.total) : ''
  const customer = data.customerName ?? 'customer'
  const tier = data.tier ?? ''

  switch (type) {
    case 'ORDER_CREATED':
      return [store, orderNo, customer, total]
    case 'ORDER_PAID':
    case 'QRIS_PAID':
    case 'PAYMENT_VERIFIED':
      return recipient === 'buyer' ? [store, orderNo, total] : [customer, orderNo, total]
    case 'PAYMENT_PROOF_UPLOADED':
      return [customer, orderNo, total]
    case 'ORDER_SHIPPED':
      return [store, orderNo, data.trackingNumber ?? '']
    case 'ORDER_COMPLETED':
    case 'ORDER_CANCELLED':
      return [store, orderNo]
    case 'TRIAL_ENDING_SOON':
    case 'SUBSCRIPTION_ENDING_SOON':
      return [store, String(data.daysLeft ?? '')]
    case 'TRIAL_ENDED':
    case 'SUBSCRIPTION_PAST_DUE':
    case 'SUBSCRIPTION_EXPIRED':
    case 'SUBSCRIPTION_ENDED':
      return [store]
    case 'SUBSCRIPTION_VERIFIED':
    case 'SUBSCRIPTION_REJECTED':
      return [store, tier]
    case 'STAFF_ADDED':
      return [store]
    default:
      return [store]
  }
}

// ---------------------------------------------------------------------------
// Resolusi penerima (email + nomor WA) — tidak pernah melempar
// ---------------------------------------------------------------------------

export interface ResolvedRecipient {
  email: string | null
  phone: string | null
  prefs: NotificationPreferences
}

async function latestValue(
  client: SupabaseClient,
  table: string,
  column: string,
  eqColumn: string,
  eqValue: string
): Promise<string | null> {
  try {
    const { data, error } = await client
      .from(table)
      .select(column)
      .eq(eqColumn, eqValue)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    const value = (data as unknown as Record<string, unknown>)[column]
    return typeof value === 'string' && value.trim() ? value : null
  } catch {
    return null
  }
}

async function resolveRecipient(
  client: SupabaseClient,
  input: Pick<DispatchInput, 'userId' | 'email' | 'phone'>
): Promise<ResolvedRecipient> {
  const prefs = input.userId
    ? await getNotificationPreferences(client, input.userId)
    : { ...DEFAULT_NOTIFICATION_PREFERENCES }

  let email: string | null = input.email?.trim() || null
  if (!email && input.userId) {
    try {
      const { data } = await client.auth.admin.getUserById(input.userId)
      email = data?.user?.email ?? null
    } catch {
      email = null
    }
  }

  let phone: string | null = input.phone?.trim() || null
  if (!phone && prefs.whatsappNumber) phone = prefs.whatsappNumber
  if (!phone && input.userId) {
    // Pembeli: alamat terakhir → nomor HP order terakhir.
    // Pemilik toko: nomor WhatsApp tokonya (stores.whatsapp).
    phone =
      (await latestValue(client, 'buyer_addresses', 'phone', 'buyer_id', input.userId)) ??
      (await latestValue(client, 'orders', 'customer_phone', 'buyer_id', input.userId)) ??
      (await latestValue(client, 'stores', 'whatsapp', 'owner_id', input.userId))
  }
  phone = phone ? normalizeWhatsAppNumber(phone) : null

  return { email, phone, prefs }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const SKIPPED_RESULT: DispatchResult = {
  inApp: false,
  email: { status: 'skipped' },
  whatsapp: { status: 'skipped' },
}

/**
 * Kirim satu notifikasi ke satu penerima lewat semua channel yang aktif:
 * in-app (bila userId ada) + email + WhatsApp, sesuai preferensi.
 * TIDAK PERNAH melempar — hasil per channel dikembalikan + dicatat ke
 * observability. Pemanggil di alur panas: `void dispatchNotify(...)`.
 */
export async function dispatchNotify(
  client: SupabaseClient,
  input: DispatchInput,
  deps: DispatchDeps = {}
): Promise<DispatchResult> {
  const result: DispatchResult = {
    inApp: false,
    email: { status: 'skipped' },
    whatsapp: { status: 'skipped' },
  }
  try {
    const data: NotifyData = input.data ?? {}
    const channels: NotifyChannel[] = input.channels ?? ['email', 'whatsapp']

    if (input.inApp !== false && input.userId) {
      result.inApp = await notifyUser(client, {
        userId: input.userId,
        storeId: input.storeId ?? null,
        orderId: input.orderId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? '',
        link: input.link ?? null,
      })
    }

    const recipient = await resolveRecipient(client, input)
    const recipientKind: 'buyer' | 'seller' = input.recipient ?? 'buyer'

    if (channels.includes('email')) {
      if (!recipient.prefs.emailEnabled) {
        result.email = { status: 'skipped', detail: 'Preferensi email nonaktif.' }
      } else if (!isEmailConfigured()) {
        result.email = { status: 'skipped', detail: 'RESEND_API_KEY belum diisi.' }
      } else if (!recipient.email) {
        result.email = { status: 'skipped', detail: 'Tidak ada alamat email penerima.' }
      } else {
        const content = buildEmailContent(input.type, data, recipientKind)
        const sent = await sendEmail(
          { to: recipient.email, subject: content.subject, html: content.html },
          { sender: deps.emailSender }
        )
        result.email = sent.ok
          ? { status: 'sent' }
          : sent.skipped
            ? { status: 'skipped', detail: sent.reason }
            : { status: 'failed', detail: sent.error }
      }
    }

    if (channels.includes('whatsapp')) {
      if (!recipient.prefs.whatsappEnabled) {
        result.whatsapp = { status: 'skipped', detail: 'Preferensi WhatsApp nonaktif.' }
      } else if (!isWhatsAppConfigured()) {
        result.whatsapp = { status: 'skipped', detail: 'WhatsApp belum dikonfigurasi.' }
      } else if (!recipient.phone) {
        result.whatsapp = { status: 'skipped', detail: 'Nomor WhatsApp penerima kosong.' }
      } else {
        const sent = await sendWhatsAppMessage(
          {
            to: recipient.phone,
            templateName: whatsappTemplateName(input.type),
            parameters: buildWhatsAppTemplateParams(input.type, data, recipientKind),
          },
          { fetchImpl: deps.whatsappFetch }
        )
        result.whatsapp = sent.ok
          ? { status: 'sent' }
          : sent.skipped
            ? { status: 'skipped', detail: sent.reason }
            : { status: 'failed', detail: sent.error }
      }
    }

    logEvent('notify_dispatch', {
      type: input.type,
      hasUser: Boolean(input.userId),
      inApp: result.inApp,
      email: result.email.status,
      whatsapp: result.whatsapp.status,
    })
    return result
  } catch {
    // Dispatcher tidak boleh menggagalkan pemanggil — apa pun yang terjadi.
    return { ...SKIPPED_RESULT, inApp: result.inApp }
  }
}

// ---------------------------------------------------------------------------
// Event order: in-app (kedua pihak, seperti sebelumnya) + email/WA
// ---------------------------------------------------------------------------

export interface OrderEventOptions {
  trackingNumber?: string | null
  courier?: string | null
  /** Nomor HP pembeli dari order (dipakai bila pembeli tamu / tanpa akun). */
  buyerPhone?: string | null
  buyerEmail?: string | null
}

/** Jenis order yang email/WA-nya dikirim ke penjual. */
const SELLER_ORDER_TYPES: NotificationType[] = [
  'ORDER_CREATED',
  'ORDER_PAID',
  'QRIS_PAID',
  'PAYMENT_VERIFIED',
  'ORDER_CANCELLED',
]

/** Jenis order yang email/WA-nya dikirim ke pembeli. */
const BUYER_ORDER_TYPES: NotificationType[] = [
  'ORDER_PAID',
  'QRIS_PAID',
  'PAYMENT_VERIFIED',
  'ORDER_SHIPPED',
  'ORDER_COMPLETED',
  'ORDER_CANCELLED',
]

/**
 * Satu pintu untuk semua event order: in-app ke pemilik toko + pembeli
 * login (lewat notifyOrderStatusChange yang sudah ada), lalu email + WA
 * sesuai daftar di atas. Tidak pernah melempar. Pemanggil di alur panas:
 * `void notifyOrderEvent(...)`.
 */
export async function notifyOrderEvent(
  client: SupabaseClient,
  party: OrderParty,
  type: NotificationType,
  storeName: string,
  opts: OrderEventOptions = {},
  deps: DispatchDeps = {}
): Promise<DispatchResult[]> {
  const results: DispatchResult[] = []
  try {
    await notifyOrderStatusChange(client, party, type, storeName)
  } catch {}

  const data: NotifyData = {
    storeName,
    orderNumber: party.invoiceNumber || undefined,
    customerName: party.customerName,
    total: party.total,
    trackingNumber: opts.trackingNumber ?? null,
    courier: opts.courier ?? null,
  }

  if (SELLER_ORDER_TYPES.includes(type)) {
    const seller = sellerStatusMessage(type, party.customerName)
    results.push(
      await dispatchNotify(
        client,
        {
          userId: party.ownerId,
          storeId: party.storeId,
          orderId: party.orderId,
          type,
          title: seller.title,
          body: seller.body,
          link: `/dashboard/orders/${party.orderId}`,
          data: { ...data, link: `/dashboard/orders/${party.orderId}` },
          inApp: false,
          recipient: 'seller',
        },
        deps
      )
    )
  }

  if (BUYER_ORDER_TYPES.includes(type)) {
    const buyer = buyerStatusMessage(
      type === 'QRIS_PAID' ? 'PAID' : type,
      storeName
    )
    const buyerLink = party.buyerId
      ? `/akun/pesanan/${party.orderId}`
      : party.invoiceNumber
        ? `/track/${party.invoiceNumber}`
        : null
    results.push(
      await dispatchNotify(
        client,
        {
          userId: party.buyerId,
          email: opts.buyerEmail ?? null,
          phone: opts.buyerPhone ?? null,
          storeId: party.storeId,
          orderId: party.orderId,
          type,
          title: buyer.title,
          body: buyer.body,
          link: buyerLink,
          data: { ...data, link: buyerLink },
          inApp: false,
          recipient: 'buyer',
        },
        deps
      )
    )
  }

  return results
}
