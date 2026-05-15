'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { CheckoutFormInput, PaymentMethod } from '@/lib/types/order'
import {
  calculateItemSubtotal,
  calculateOrderTotal,
  calculateSubtotal,
  normalizePhoneNumber,
} from '@/lib/utils/order'

function isValidPaymentMethod(value: string): value is PaymentMethod {
  return ['BANK_TRANSFER', 'QRIS', 'COD'].includes(value)
}

function generateSafeInvoiceNumber() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const time = `${String(now.getHours()).padStart(2, '0')}${String(
    now.getMinutes()
  ).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')

  return `INV-${year}${month}${day}-${time}-${random}`
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  )
}

export async function createOrderAction(input: CheckoutFormInput) {
  const supabase = await createClient()

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

  const normalizedPhone = normalizePhoneNumber(input.customerPhone)
  const subtotal = calculateSubtotal(input.items)
  const shippingCost = Number(shippingMethod.price)
  const total = calculateOrderTotal(subtotal, shippingCost)

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

  const orderItemsPayload = input.items.map((item) => ({
    order_id: order.id,
    product_id: item.productId || null,
    product_name: item.productName,
    qty: item.qty,
    price: item.price,
    subtotal: calculateItemSubtotal(item.price, item.qty),
    notes: item.notes?.trim() || null,
  }))

  const { error: orderItemsError } = await supabase
    .from('order_items')
    .insert(orderItemsPayload)

  if (orderItemsError) {
    throw new Error('Gagal menyimpan item order.')
  }

  let invoiceNumber = ''
  let invoiceInserted = false
  let lastInvoiceError: unknown = null

  for (let attempt = 0; attempt < 5; attempt++) {
    invoiceNumber = generateSafeInvoiceNumber()

    const { error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        order_id: order.id,
        invoice_number: invoiceNumber,
        payment_status: 'PENDING_PAYMENT',
        payment_method: input.paymentMethod,
        total,
      })

    if (!invoiceError) {
      invoiceInserted = true
      break
    }

    lastInvoiceError = invoiceError

    if (!isUniqueViolation(invoiceError)) {
      throw new Error('Gagal membuat invoice.')
    }
  }

  if (!invoiceInserted) {
    throw new Error('Gagal membuat invoice unik. Silakan coba lagi.')
  }

  redirect(`/invoice/${invoiceNumber}`)
}