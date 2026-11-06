export interface Product {
  id: string
  name: string
  slug: string
  price: number
  store_id?: string | null
  description?: string | null
  stock?: number | null
  available?: boolean | null
  images?: string[] | null
  badge?: string | null
}

export interface CartItem {
  product: Product
  qty: number
}
