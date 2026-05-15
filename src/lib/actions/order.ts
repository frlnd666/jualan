'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface PlaceOrderInput {
  storeId: string
  items: {
    productId: string
    productName: string
    qty: number
    price: number
    notes?: string | null
  }[]
  customerName: string
  customerPhone: string
  address: string
  province: string
  city: string
  postalCode: string
  notes?: string
  shippingMethodName: string
  shippingCost: number
  paymentMethod: string
}

export async function placeOrder(input: PlaceOrderInput) {
  const supabase = await createClient()

  // Hitung subtotal dan total
  const subtotal = input.items.reduce((sum, i) => sum + i.price * i.qty, 0)
  const total = subtotal + input.shippingCost

  // 1. Insert order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      store_id: input.storeId,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      address: input.address,
      province: input.province,
      city: input.city,
      postal_code: input.postalCode,
      notes: input.notes ?? null,
      subtotal,
      shipping_cost: input.shippingCost,
      total,
      status: 'PENDING_PAYMENT',
      payment_method: input.paymentMethod,
      shipping_method_name: input.shippingMethodName,
    })
    .select()
    .single()

  if (orderError || !order) {
    throw new Error(`Gagal membuat pesanan: ${orderError?.message ?? 'unknown error'}`)
  }

  // 2. Insert order_items — dengan subtotal per item + error handling
  const orderItemsPayload = input.items.map((i) => ({
    order_id: order.id,
    product_id: i.productId,
    product_name: i.productName,
    qty: i.qty,
    price: i.price,
    subtotal: i.price * i.qty, // ✅ fix: subtotal per item dihitung
    notes: i.notes ?? null,
  }))

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItemsPayload)

  if (itemsError) {
    // Rollback order jika item gagal tersimpan
    await supabase.from('orders').delete().eq('id', order.id)
    throw new Error(`Gagal menyimpan item pesanan: ${itemsError.message}`)
  }

  // 3. Generate invoice number — pakai fragment order.id, hindari race condition
  const year = new Date().getFullYear()
  const fragment = order.id.replace(/-/g, '').slice(0, 6).toUpperCase()
  const invoiceNumber = `INV-${year}-${fragment}`

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      order_id: order.id,
      invoice_number: invoiceNumber,
      payment_status: 'PENDING',
    })
    .select()
    .single()

  if (invoiceError || !invoice) {
    // Rollback order dan items
    await supabase.from('order_items').delete().eq('order_id', order.id)
    await supabase.from('orders').delete().eq('id', order.id)
    throw new Error(`Gagal membuat invoice: ${invoiceError?.message ?? 'unknown error'}`)
  }

  // 4. Buat chat thread
  await supabase.from('chats').insert({ order_id: order.id })

  redirect(`/invoice/${invoiceNumber}`)
}