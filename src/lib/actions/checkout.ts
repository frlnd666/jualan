'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createPublicInvoiceClient } from '@/lib/invoice-access'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  allowedCheckoutMethods,
  getStoreSubscription,
} from '@/lib/subscriptions'
import type { CheckoutFormInput, PaymentMethod } from '@/lib/types/order'
import { normalizePhoneNumber } from '@/lib/utils/order'

function isValidPaymentMethod(value: string): value is PaymentMethod {
  return ['BANK_TRANSFER', 'QRIS', 'COD'].includes(value)
}

const INVOICE_SUFFIX_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * Nomor invoice: tanggal + suffix 12 karakter dari Web Crypto.
 * Format lama (jam pembuatan + 4 digit Math.random) bisa ditebak —
 * halaman invoice bersifat publik, jadi nomornya tidak boleh enumerable.
 */
function generateSafeInvoiceNumber() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  const suffix = Array.from(bytes, (b) => INVOICE_SUFFIX_ALPHABET[b % INVOICE_SUFFIX_ALPHABET.length]).join('')

  return `INV-${year}${month}${day}-${suffix}`
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  )
}

function isMissingColumnError(error: unknown, column: string) {
  if (typeof error !== 'object' || error === null || !('message' in error)) return false
  const message = String(error.message)
  return message.includes(column) && (message.includes('schema cache') || message.includes('column'))
}

interface DbProduct {
  id: string
  name: string
  price: number
  stock: number | null
  available: boolean | null
}

export async function createOrderAction(input: CheckoutFormInput) {
  // Seluruh penulisan order dilakukan lewat client publik (service_role bila
  // sudah dikonfigurasi) karena setelah RLS ditutup, checkout tamu tidak lagi
  // diberi hak baca/tulis langsung yang longgar. Validasi di bawah inilah
  // batas keamanannya: tidak ada nilai uang/stok yang dipercaya dari client.
  const supabase = await createPublicInvoiceClient()

  if (!input.storeId) throw new Error('Store tidak ditemukan.')
  if (!input.customerName?.trim()) throw new Error('Nama customer wajib diisi.')
  if (!input.customerPhone?.trim()) throw new Error('Nomor WhatsApp wajib diisi.')
  if (!input.address?.trim()) throw new Error('Alamat wajib diisi.')
  if (!input.province?.trim()) throw new Error('Provinsi wajib diisi.')
  if (!input.city?.trim()) throw new Error('Kota wajib diisi.')
  if (!input.postalCode?.trim()) throw new Error('Kode pos wajib diisi.')
  if (!input.shippingMethodId?.trim()) throw new Error('Metode pengiriman wajib dipilih.')
  if (!isValidPaymentMethod(input.paymentMethod)) throw new Error('Metode pembayaran tidak valid.')
  if (!input.items?.length) throw new Error('Cart kosong.')

  // Fase 1 (Bab 3): toko Free hanya boleh COD; toko yang dibekukan admin
  // (SUSPENDED) tidak menerima pesanan sama sekali. Cek ini di server —
  // pilihan di halaman checkout hanya cerminan, bukan penegak.
  const subscription = await getStoreSubscription(supabase, input.storeId)
  if (subscription.status === 'SUSPENDED') {
    throw new Error('Toko ini sedang dibekukan dan tidak menerima pesanan.')
  }
  const allowedMethods = allowedCheckoutMethods(subscription)
  if (!allowedMethods.includes(input.paymentMethod)) {
    throw new Error(
      'Toko ini hanya menerima pembayaran COD. Pilih COD untuk melanjutkan.'
    )
  }

  // Anti-spam order: batasi per nomor WhatsApp dan per alamat IP.
  // (Limiter in-memory per instance — lihat lib/rate-limit.ts.)
  const rateLimitPhone = normalizePhoneNumber(input.customerPhone)
  const phoneLimit = checkRateLimit(`checkout:phone:${rateLimitPhone}`, 5, 10 * 60 * 1000)
  if (!phoneLimit.allowed) {
    throw new Error('Terlalu banyak pesanan dari nomor ini. Coba lagi beberapa menit lagi.')
  }

  const requestHeaders = await headers()
  const clientIp =
    requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const ipLimit = checkRateLimit(`checkout:ip:${clientIp}`, 20, 10 * 60 * 1000)
  if (!ipLimit.allowed) {
    throw new Error('Terlalu banyak pesanan dari koneksi ini. Coba lagi beberapa menit lagi.')
  }

  const { data: shippingMethod, error: shippingError } = await supabase
    .from('shipping_methods')
    .select('id, store_id, name, price, estimated_days, is_active')
    .eq('id', input.shippingMethodId)
    .eq('store_id', input.storeId)
    .maybeSingle()

  if (shippingError) {
    throw new Error('Gagal mengambil metode pengiriman.')
  }

  if (!shippingMethod) {
    throw new Error('Metode pengiriman tidak ditemukan.')
  }

  if ('is_active' in shippingMethod && shippingMethod.is_active === false) {
    throw new Error('Metode pengiriman sedang tidak aktif.')
  }

  // === Harga, nama, dan stok SELALU diambil ulang dari database ===
  // input.items[].price / productName dari browser tidak pernah dipercaya:
  // keduanya bisa diubah bebas di devtools / request POST langsung.
  const requestedIds = [...new Set(input.items.map((item) => item.productId).filter(Boolean))]

  if (requestedIds.length !== input.items.length) {
    throw new Error('Ada item tanpa produk yang valid di cart.')
  }

  const { data: productRows, error: productsError } = await supabase
    .from('products')
    .select('id, name, price, stock, available')
    .in('id', requestedIds)
    .eq('store_id', input.storeId)

  if (productsError) {
    throw new Error('Gagal memverifikasi produk.')
  }

  const productById = new Map<string, DbProduct>(
    ((productRows || []) as DbProduct[]).map((p) => [p.id, p])
  )

  const verifiedItems = input.items.map((item) => {
    const product = productById.get(item.productId)
    if (!product) {
      throw new Error('Ada produk di cart yang tidak ditemukan di toko ini.')
    }
    if (product.available === false) {
      throw new Error(`Produk "${product.name}" sedang tidak tersedia.`)
    }
    const qty = Math.floor(Number(item.qty))
    if (!Number.isFinite(qty) || qty < 1) {
      throw new Error(`Jumlah untuk "${product.name}" tidak valid.`)
    }
    const stock = Number(product.stock ?? 0)
    if (qty > stock) {
      throw new Error(`Stok "${product.name}" tidak cukup (tersisa ${stock}).`)
    }
    return {
      product,
      qty,
      price: Number(product.price),
      notes: item.notes?.trim() || null,
    }
  })

  const normalizedPhone = normalizePhoneNumber(input.customerPhone)
  const subtotal = verifiedItems.reduce((sum, item) => sum + item.price * item.qty, 0)
  const shippingCost = Number(shippingMethod.price)
  const total = subtotal + shippingCost

  // Fase 2: bila pembeli login, ikat order ke akunnya supaya muncul di
  // riwayat pesanan (/akun/pesanan). Tamu tetap jalan (buyer_id null).
  // Bila kolom buyer_id belum ada (migrasi f2 belum dijalankan), insert
  // diulang tanpa kolom itu — checkout tidak boleh mati karenanya.
  let buyerId: string | null = null
  try {
    const userClient = await createClient()
    const {
      data: { user: buyerUser },
    } = await userClient.auth.getUser()
    buyerId = buyerUser?.id ?? null
  } catch {}

  const orderPayload = {
    store_id: input.storeId,
    customer_name: input.customerName.trim(),
    customer_phone: normalizedPhone,
    address: input.address.trim(),
    province: input.province.trim(),
    city: input.city.trim(),
    postal_code: input.postalCode.trim(),
    notes: input.notes?.trim() || null,
    subtotal,
    shipping_cost: shippingCost,
    total,
    status: 'PENDING_PAYMENT',
    payment_method: input.paymentMethod,
    shipping_method_name: shippingMethod.name,
    ...(buyerId ? { buyer_id: buyerId } : {}),
  }

  let order: { id: string } | null = null
  let orderError: { message?: string } | null = null
  {
    const attempt = await supabase
      .from('orders')
      .insert(orderPayload)
      .select('id')
      .single()
    order = attempt.data as { id: string } | null
    orderError = attempt.error as { message?: string } | null
    if (orderError && buyerId && isMissingColumnError(orderError, 'buyer_id')) {
      const legacyPayload = { ...orderPayload }
      delete legacyPayload.buyer_id
      const retry = await supabase
        .from('orders')
        .insert(legacyPayload)
        .select('id')
        .single()
      order = retry.data as { id: string } | null
      orderError = retry.error as { message?: string } | null
      // Order tamu tanpa ikatan akun — keranjang tersimpan tidak ada
      // yang perlu dibersihkan.
      buyerId = null
    }
  }

  if (orderError || !order) {
    throw new Error('Gagal membuat order.')
  }

  // Rollback: Supabase JS tidak punya transaksi multi-tabel, jadi kegagalan
  // di langkah mana pun setelah order dibuat harus membersihkan order +
  // itemnya. Stok yang sudah terlanjur dikurangi dikembalikan lewat RPC
  // increment_stock (MENAMBAH qty secara atomik) — bukan dengan menulis
  // ulang nilai stok lama seperti sebelumnya, supaya tidak menimpa
  // perubahan stok lain yang terjadi bersamaan (checkout lain / edit
  // seller). Definisi RPC: supabase/migrations/20261108_f0_stock_rpc.sql
  const orderId = order.id
  const decremented: { product: DbProduct; qty: number }[] = []
  async function rollbackOrder() {
    for (const entry of decremented) {
      await supabase.rpc('increment_stock', {
        p_product_id: entry.product.id,
        p_qty: entry.qty,
      })
    }
    await supabase.from('order_items').delete().eq('order_id', orderId)
    await supabase.from('orders').delete().eq('id', orderId)
  }

  const orderItemsPayload = verifiedItems.map((item) => ({
    order_id: order.id,
    product_id: item.product.id,
    product_name: item.product.name,
    qty: item.qty,
    price: item.price,
    subtotal: item.price * item.qty,
    notes: item.notes,
  }))

  const { error: orderItemsError } = await supabase
    .from('order_items')
    .insert(orderItemsPayload)

  if (orderItemsError) {
    await rollbackOrder()
    throw new Error('Gagal menyimpan item order.')
  }

  // Kurangi stok lewat RPC atomik: fungsi decrement_stock mengunci baris
  // produk (SELECT ... FOR UPDATE), memeriksa stok cukup, lalu mengurangi
  // — semuanya dalam satu transaksi Postgres. Dua checkout bersamaan tidak
  // bisa sama-sama lolos dari stok yang sama. Optimistic lock di kode
  // aplikasi (update ... where stock = nilai_lama) sudah digantikan RPC
  // ini; definisi fungsi: supabase/migrations/20261108_f0_stock_rpc.sql
  for (const item of verifiedItems) {
    const { data: stockDecreased, error: stockError } = await supabase.rpc(
      'decrement_stock',
      { p_product_id: item.product.id, p_qty: item.qty }
    )

    if (stockError || stockDecreased !== true) {
      await rollbackOrder()
      throw new Error(`Stok "${item.product.name}" baru saja berubah. Silakan coba lagi.`)
    }
    decremented.push({ product: item.product, qty: item.qty })
  }

  const accessToken = crypto.randomUUID()
  let invoiceNumber = ''
  let invoiceInserted = false
  let tokenStored = false

  for (let attempt = 0; attempt < 5 && !invoiceInserted; attempt++) {
    invoiceNumber = generateSafeInvoiceNumber()

    const basePayload = {
      order_id: order.id,
      invoice_number: invoiceNumber,
      payment_status: 'PENDING_PAYMENT',
      payment_method: input.paymentMethod,
      total,
    }

    // Coba simpan token dulu; bila kolom access_token belum ada (migrasi
    // belum dijalankan), jatuh ke payload lama agar checkout tidak mati —
    // halaman publik lalu berjalan di mode legacy (PII tetap disamarkan).
    const withToken = await supabase
      .from('invoices')
      .insert({ ...basePayload, access_token: accessToken })

    if (!withToken.error) {
      invoiceInserted = true
      tokenStored = true
      break
    }

    if (isMissingColumnError(withToken.error, 'access_token')) {
      const withoutToken = await supabase.from('invoices').insert(basePayload)
      if (!withoutToken.error) {
        invoiceInserted = true
        tokenStored = false
        break
      }
      if (!isUniqueViolation(withoutToken.error)) {
        await rollbackOrder()
        throw new Error('Gagal membuat invoice.')
      }
      continue
    }

    if (!isUniqueViolation(withToken.error)) {
      await rollbackOrder()
      throw new Error('Gagal membuat invoice.')
    }
  }

  if (!invoiceInserted) {
    await rollbackOrder()
    throw new Error('Gagal membuat invoice unik. Silakan coba lagi.')
  }

  // Fase 2: pesanan pembeli login berhasil — bersihkan juga keranjang
  // tersimpan di akun (keranjang lokal dibersihkan halaman checkout).
  // Best-effort: kegagalan di sini tidak boleh menggagalkan pesanan.
  if (buyerId) {
    try {
      await supabase
        .from('buyer_carts')
        .delete()
        .eq('buyer_id', buyerId)
        .eq('store_id', input.storeId)
    } catch {}
  }

  // &baru=1 membuat halaman invoice menampilkan sambutan "pesanan berhasil
  // dibuat" + langkah pembayaran bernomor (mode sukses setelah checkout).
  redirect(
    tokenStored
      ? `/invoice/${invoiceNumber}?t=${encodeURIComponent(accessToken)}&baru=1`
      : `/invoice/${invoiceNumber}?baru=1`
  )
}
