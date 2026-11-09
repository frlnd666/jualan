// Aturan transisi status order — modul BIASA (tanpa 'use server').
//
// Dipindah ke sini dari src/lib/actions/order-fulfillment.ts pada
// 2026-11-09: file 'use server' HANYA boleh mengekspor async function.
// `ALLOWED_TRANSITIONS` adalah objek biasa — mengekspornya dari file
// 'use server' membuat modul action gagal dimuat saat dievaluasi
// ("A \"use server\" file can only export async functions, found object"),
// sehingga SEMUA aksi seller di halaman detail order (konfirmasi
// pembayaran, ubah status, simpan resi) mengembalikan HTTP 500 dan tidak
// pernah jalan — padahal halaman GET-nya termuat normal. Cacat ini
// lolos `next build`, tsc, eslint, dan vitest karena validasi itu baru
// terjadi saat runtime mengevaluasi modul untuk POST server action.
//
// Dipakai update status tunggal (order-fulfillment.ts) dan massal
// (order-management.ts) — satu sumber kebenaran, bukan duplikat aturan.
import type { OrderStatus } from '@/lib/types/order'

/**
 * Transisi status order yang boleh dilakukan seller dari dashboard.
 * Status terminal (COMPLETED, CANCELLED) tidak punya transisi keluar.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['CANCELLED'],
  PAID: ['PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'COMPLETED', 'CANCELLED'],
  SHIPPED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
}
