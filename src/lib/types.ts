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
  /** Berat per unit (gram, Fase 3) — dipakai hitung ongkir. */
  weight_gram?: number | null
}

export interface CartItem {
  product: Product
  qty: number
}
