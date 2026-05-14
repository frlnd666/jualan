export type OrderStatus =
| 'PENDING_PAYMENT'
| 'PAID'
| 'PROCESSING'
| 'SHIPPED'
| 'COMPLETED'
| 'CANCELLED'
| 'REFUNDED'
export type PaymentMethod = 'bank_transfer' | 'qris' | 'cod'
export type SenderType = 'seller' | 'customer'
export interface Store {
id: string
owner_id: string
name: string
slug: string
description: string | null
logo_url: string | null
banner_url: string | null
theme: string
whatsapp: string | null
created_at: string
}
export interface ProductCategory {
id: string
store_id: string
name: string
sort_order: number
}
export interface Product {
id: string
store_id: string
category_id: string | null
name: string
slug: string
description: string | null
price: number
stock: number
images: string[]
badge: string | null
available: boolean
created_at: string
}
export interface ShippingMethod {
id: string
store_id: string
name: string
price: number
estimated_days: string | null
}
export interface Order {
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
created_at: string
}
export interface OrderItem {
id: string
order_id: string
product_id: string | null
product_name: string
qty: number
price: number
notes: string | null
}
export interface Invoice {
id: string
order_id: string
invoice_number: string
payment_status: 'UNPAID' | 'PAID'
payment_proof_url: string | null
created_at: string
}
export interface ChatMessage {
id: string
chat_id: string
sender_type: SenderType
message: string | null
image_url: string | null
created_at: string
}
export interface CartItem {
product: Product
qty: number
}
