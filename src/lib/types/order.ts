export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'COMPLETED'
  | 'CANCELLED'

export type PaymentStatus =
  | 'PENDING_PAYMENT'
  | 'WAITING_VERIFICATION'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'

export type PaymentMethod = 'BANK_TRANSFER' | 'QRIS' | 'COD'

export interface ShippingMethod {
  id: string
  store_id: string
  name: string
  price: number
  estimated_days: string | null
  is_active?: boolean
  created_at?: string | null
  /** Kode kurir bebas (Fase 3), mis. JNE / JNT / TOKO. */
  courier_code?: string | null
  /** Ongkir tambahan per kg di atas berat dasar (Fase 3). */
  per_kg_price?: number | null
  /** Berat (gram) yang sudah termasuk di harga dasar (Fase 3). */
  base_weight_gram?: number | null
}

export interface CartItemInput {
  productId: string
  productName: string
  qty: number
  price: number
  notes?: string | null
}

export interface CheckoutFormInput {
  storeId: string
  customerName: string
  customerPhone: string
  address: string
  province: string
  city: string
  postalCode: string
  notes?: string
  shippingMethodId: string
  paymentMethod: PaymentMethod
  /** Kode voucher (opsional) — divalidasi ulang di server. */
  voucherCode?: string
  items: CartItemInput[]
}

export interface OrderRow {
  id: string
  store_id: string
  customer_name: string
  customer_phone: string
  address: string
  province: string
  city: string
  postal_code: string
  notes: string | null
  subtotal: number
  shipping_cost: number
  total: number
  status: OrderStatus
  payment_method: PaymentMethod
  shipping_method_name: string | null
  /** Kode voucher yang dipakai (Fase 3), null bila tanpa voucher. */
  voucher_code?: string | null
  discount_amount?: number | null
  total_weight_gram?: number | null
  seller_note?: string | null
  created_at: string | null
  updated_at?: string | null
}

export interface OrderItemRow {
  id: string
  order_id: string
  product_id: string | null
  product_name: string
  qty: number
  price: number
  subtotal: number
  notes: string | null
}

export interface InvoiceRow {
  id: string
  order_id: string
  invoice_number: string
  payment_status: PaymentStatus
  payment_proof_url: string | null
  total: number
  payment_method: PaymentMethod | null
  created_at: string | null
  updated_at?: string | null
}