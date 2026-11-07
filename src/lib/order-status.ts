/**
 * Sumber tunggal label & alur status order/pembayaran.
 *
 * Sebelumnya fungsi label yang sama disalin-tempel di halaman invoice,
 * tracking, dan dashboard (dan sempat tidak sinkron). Semua tampilan status
 * untuk pembeli memakai modul ini; dashboard akan menyusul memakai sumber
 * yang sama.
 */

export function getPaymentStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'Menunggu pembayaran'
    case 'WAITING_VERIFICATION':
      return 'Menunggu verifikasi'
    case 'PAID':
      return 'Sudah dibayar'
    case 'FAILED':
      return 'Pembayaran gagal'
    case 'REFUNDED':
      return 'Dana dikembalikan'
    default:
      return status || '-'
  }
}

export function getOrderStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'Menunggu pembayaran'
    case 'PAID':
      return 'Sudah dibayar'
    case 'PROCESSING':
      return 'Sedang diproses'
    case 'SHIPPED':
      return 'Sedang dikirim'
    case 'COMPLETED':
      return 'Selesai'
    case 'CANCELLED':
      return 'Dibatalkan'
    default:
      return status || '-'
  }
}

export function getPaymentMethodLabel(method: string | null): string {
  switch (method) {
    case 'BANK_TRANSFER':
      return 'Transfer bank'
    case 'QRIS':
      return 'QRIS'
    case 'COD':
      return 'COD (bayar di tempat)'
    default:
      return '-'
  }
}

export function getShipmentStatusLabel(status: string | null): string {
  switch (status) {
    case 'PENDING':
      return 'Menunggu diproses'
    case 'PROCESSING':
      return 'Sedang diproses'
    case 'SHIPPED':
      return 'Sedang dikirim'
    case 'DELIVERED':
      return 'Sudah diterima'
    case 'CANCELLED':
      return 'Dibatalkan'
    default:
      return status || '-'
  }
}

export type OrderStep = {
  key: string
  title: string
  description: string
  done: boolean
  active: boolean
}

/**
 * Timeline perjalanan pesanan dari sisi pembeli. Semantikanya sama persis
 * dengan timeline yang dulu hanya ada di halaman /track — sekarang dipakai
 * halaman invoice gabungan.
 */
export function buildOrderTimeline(
  orderStatus: string,
  paymentStatus: string
): OrderStep[] {
  return [
    {
      key: 'order-created',
      title: 'Pesanan dibuat',
      description: 'Pesananmu sudah masuk dan invoice berhasil dibuat.',
      done: true,
      active: false,
    },
    {
      key: 'waiting-payment',
      title: 'Menunggu pembayaran',
      description:
        'Selesaikan pembayaran sesuai metode yang dipilih saat checkout.',
      done: paymentStatus === 'WAITING_VERIFICATION' || paymentStatus === 'PAID',
      active: paymentStatus === 'PENDING_PAYMENT',
    },
    {
      key: 'paid',
      title: 'Pembayaran terkonfirmasi',
      description: 'Pembayaran diterima dan pesanan siap diproses penjual.',
      done:
        paymentStatus === 'PAID' ||
        ['PROCESSING', 'SHIPPED', 'COMPLETED'].includes(orderStatus),
      active: paymentStatus === 'PAID' && orderStatus === 'PAID',
    },
    {
      key: 'processing',
      title: 'Pesanan diproses',
      description: 'Penjual sedang menyiapkan produkmu untuk dikirim.',
      done: ['PROCESSING', 'SHIPPED', 'COMPLETED'].includes(orderStatus),
      active: orderStatus === 'PROCESSING',
    },
    {
      key: 'shipped',
      title: 'Pesanan dikirim',
      description: 'Pesananmu sudah dikirim dan sedang dalam perjalanan.',
      done: ['SHIPPED', 'COMPLETED'].includes(orderStatus),
      active: orderStatus === 'SHIPPED',
    },
    {
      key: 'completed',
      title: 'Pesanan selesai',
      description: 'Pesanan sudah diterima / ditandai selesai.',
      done: orderStatus === 'COMPLETED',
      active: orderStatus === 'COMPLETED',
    },
  ]
}
