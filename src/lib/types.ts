export interface Product {
  id: string
  name: string
  slug: string
  price: number
  images?: string[] | null
  badge?: string | null
}

export interface CartItem {
  product: Product
  qty: number
}