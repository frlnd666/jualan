'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createPublicInvoiceClient } from '@/lib/invoice-access'
import { checkRateLimit } from '@/lib/rate-limit'
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

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
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
    })
    .select('id')
    .single()

  if (orderError || !order) {
    throw new Error('Gagal membuat order.')
  }

  // Rollback manual: Supabase JS tidak punya transaksi multi-tabel, jadi
  // kegagalan di langkah mana pun setelah ini harus membersihkan order +
  // mengembalikan stok yang sudah terlanjur dikurangi.
  const orderId = order.id
  const decremented: { product: DbProduct; qty: number }[] = []
  async function rollbackOrder() {
    for (const entry of decremented) {
      await supabase
        .from('products')
        .update({ stock: Number(entry.product.stock ?? 0) })
        .eq('id', entry.product.id)
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

  // Kurangi stok dengan optimistic lock (nilai stok lama ikut dibandingkan),
  // supaya dua checkout bersamaan tidak bisa sama-sama lolos dari stok yang
  // sama. Untuk atomisitas penuh, migrasi P0 menyediakan catatan RPC —
  // lihat supabase/migrations/20261107_p0_security.sql bagian catatan.
  for (const item of verifiedItems) {
    const currentStock = Number(item.product.stock ?? 0)
    const { data: updated, error: stockError } = await supabase
      .from('products')
      .update({ stock: currentStock - item.qty })
      .eq('id', item.product.id)
      .eq('stock', currentStock)
      .select('id')

    if (stockError || !updated || updated.length === 0) {
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

  redirect(
    tokenStored
      ? `/invoice/${invoiceNumber}?t=${encodeURIComponent(accessToken)}`
      : `/invoice/${invoiceNumber}`
  )
}
