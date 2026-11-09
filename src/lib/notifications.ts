// Notifikasi in-app (Fase 3). TIDAK ADA infrastruktur notifikasi
// sebelumnya di repo — file ini yang pertama. Dibuat server-side lewat
// service_role (tulis tabel notifications tidak diberi policy publik).
// Pemanggilan di sini best-effort: kegagalan notifikasi TIDAK BOLEH
// menggagalkan alur utama (checkout / webhook / konfirmasi bayar).
//
// Email + WhatsApp dibangun di atas file ini: dispatcher terpusat di
// src/lib/notify.ts memakai notifyUser di bawah untuk in-app, lalu
// mengirim email (Resend) + WA (Meta Cloud API) sesuai preferensi.
// Lihat supabase/README.md bagian "Notifikasi email + WhatsApp".

import type { SupabaseClient } from '@supabase/supabase-js'

export type NotificationType =
  | 'ORDER_CREATED'
  | 'ORDER_PAID'
  | 'PAYMENT_VERIFIED'
  | 'QRIS_PAID'
  | 'ORDER_SHIPPED'
  | 'ORDER_COMPLETED'
  | 'ORDER_CANCELLED'
  // Bukti bayar diunggah pembeli (ke seller) — email/WA + in-app.
  | 'PAYMENT_PROOF_UPLOADED'
  // Verifikasi pembayaran langganan oleh admin (ke seller).
  | 'SUBSCRIPTION_VERIFIED'
  | 'SUBSCRIPTION_REJECTED'
  // Staff baru ditambahkan (ke staff).
  | 'STAFF_ADDED'
  // Cron langganan (transisi status + pengingat H-3/H-1).
  | 'TRIAL_ENDING_SOON'
  | 'TRIAL_ENDED'
  | 'SUBSCRIPTION_ENDING_SOON'
  | 'SUBSCRIPTION_PAST_DUE'
  | 'SUBSCRIPTION_EXPIRED'
  | 'SUBSCRIPTION_ENDED'

export interface NotifyInput {
  userId: string
  storeId?: string | null
  orderId?: string | null
  type: NotificationType
  title: string
  body?: string
  link?: string | null
}

/** Sisipkan satu notifikasi. Mengembalikan false bila gagal (best-effort). */
export async function notifyUser(
  supabase: SupabaseClient,
  input: NotifyInput
): Promise<boolean> {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: input.userId,
      store_id: input.storeId ?? null,
      order_id: input.orderId ?? null,
      type: input.type,
      title: input.title,
      body: input.body ?? '',
      link: input.link ?? null,
    })
    // Bila tabel belum ada (migrasi f3 belum dijalankan), insert gagal —
    // itu keadaan transisi yang diharapkan, bukan error fatal.
    if (error) return false
    return true
  } catch {
    return false
  }
}

export interface OrderParty {
  /** Pemilik toko (penerima notifikasi seller). */
  ownerId: string
  /** Pembeli login (bila ada); tamu = null. */
  buyerId: string | null
  storeId: string
  orderId: string
  invoiceNumber: string
  customerName: string
  total: number
}

/** Judul + isi notifikasi untuk pembeli saat status order berubah. */
export function buyerStatusMessage(
  status: string,
  storeName: string
): { title: string; body: string } {
  switch (status) {
    case 'ORDER_CREATED':
      return {
        title: `Pesananmu di ${storeName} berhasil dibuat`,
        body: 'Selesaikan pembayaran sesuai instruksi di halaman pesananmu.',
      }
    case 'PAID':
    case 'PROCESSING':
      return {
        title: `Pembayaranmu di ${storeName} terkonfirmasi`,
        body: 'Pesananmu sedang disiapkan penjual.',
      }
    case 'SHIPPED':
      return {
        title: `Pesananmu dari ${storeName} dikirim`,
        body: 'Nomor resi sudah tersedia — lacak di halaman pesananmu.',
      }
    case 'COMPLETED':
      return {
        title: `Pesananmu dari ${storeName} selesai`,
        body: 'Terima kasih sudah berbelanja!',
      }
    case 'CANCELLED':
      return {
        title: `Pesananmu di ${storeName} dibatalkan`,
        body: 'Hubungi penjual bila kamu merasa ini keliru.',
      }
    default:
      return {
        title: `Status pesananmu di ${storeName} berubah`,
        body: 'Buka halaman pesanan untuk detailnya.',
      }
  }
}

/** Judul + isi notifikasi untuk pemilik toko saat status order berubah. */
export function sellerStatusMessage(
  status: string,
  customerName: string
): { title: string; body: string } {
  switch (status) {
    case 'ORDER_CREATED':
      return {
        title: `Pesanan baru dari ${customerName}`,
        body: 'Periksa pembayaran dan siapkan pesanan ini.',
      }
    case 'PAID':
    case 'PAYMENT_VERIFIED':
      return {
        title: `Pembayaran ${customerName} terkonfirmasi`,
        body: 'Pesanan siap diproses dan dikirim.',
      }
    case 'QRIS_PAID':
      return {
        title: `QRIS ${customerName} lunas otomatis`,
        body: 'Pembayaran QRIS terverifikasi via ShopeePay — tanpa upload bukti.',
      }
    case 'SHIPPED':
      return {
        title: `Pesanan ${customerName} sudah dikirim`,
        body: 'Resi sudah diinput dan bisa dilacak customer.',
      }
    case 'COMPLETED':
      return {
        title: `Pesanan ${customerName} selesai`,
        body: 'Pesanan sudah sampai ke tangan customer.',
      }
    case 'CANCELLED':
      return {
        title: `Pesanan ${customerName} dibatalkan`,
        body: 'Stok produk sudah dikembalikan.',
      }
    default:
      return {
        title: `Status pesanan ${customerName} berubah`,
        body: 'Buka detail pesanan untuk info lengkap.',
      }
  }
}

/**
 * Kirim notifikasi perubahan status order ke pemilik toko DAN pembeli
 * (bila pembeli login). Link mengarah ke halaman masing-masing pihak.
 */
export async function notifyOrderStatusChange(
  supabase: SupabaseClient,
  party: OrderParty,
  status: NotificationType | 'ORDER_CREATED',
  storeName: string
): Promise<void> {
  const seller = sellerStatusMessage(status, party.customerName)
  await notifyUser(supabase, {
    userId: party.ownerId,
    storeId: party.storeId,
    orderId: party.orderId,
    type: status === 'ORDER_CREATED' ? 'ORDER_CREATED' : status,
    title: seller.title,
    body: seller.body,
    link: `/dashboard/orders/${party.orderId}`,
  })

  if (party.buyerId) {
    const buyer = buyerStatusMessage(status, storeName)
    const type: NotificationType =
      status === 'QRIS_PAID' || status === 'ORDER_PAID' || status === 'PAYMENT_VERIFIED'
        ? 'ORDER_PAID'
        : status === 'ORDER_CREATED'
          ? 'ORDER_CREATED'
          : (status as NotificationType)
    await notifyUser(supabase, {
      userId: party.buyerId,
      storeId: party.storeId,
      orderId: party.orderId,
      type,
      title: buyer.title,
      body: buyer.body,
      link: `/akun/pesanan/${party.orderId}`,
    })
  }
}
