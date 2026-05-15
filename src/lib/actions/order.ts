'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface PlaceOrderInput {
  storeId: string
  items: { productId: string; productName: string; qty: number; price: number }[]
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
  const subtotal = input.items.reduce((sum, i) => sum + i.price * i.qty, 0)
  const total = subtotal + input.shippingCost

  const { data: order, error: orderError } = await supabase.from('orders').insert({
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
  }).select().single()

  if (orderError || !order) throw new Error('Gagal membuat pesanan')

  await supabase.from('order_items').insert(
    input.items.map(i => ({
      order_id: order.id,
      product_id: i.productId,
      product_name: i.productName,
      qty: i.qty,
      price: i.price,
    }))
  )

  const year = new Date().getFullYear()
  const { count } = await supabase.from('invoices').select('id', { count: 'exact', head: true })
  const seq = String((count ?? 0) + 1).padStart(4, '0')
  const invoiceNumber = `INV-${year}-${seq}`

  const { data: invoice } = await supabase.from('invoices').insert({
    order_id: order.id,
    invoice_number: invoiceNumber,
    payment_status: 'UNPAID',
  }).select().single()

  await supabase.from('chats').insert({ order_id: order.id })
  redirect(`/invoice/${invoiceNumber}`)
}