// Server action keranjang pembeli (Fase 2): keranjang tersimpan di akun,
// bukan hanya localStorage perangkat. Dipakai BuyerCartSync (sinkronisasi
// otomatis saat login) dan halaman cart/checkout.
//
// Aturan: satu keranjang per pembeli, satu toko per keranjang — sama
// seperti aturan keranjang lokal di lib/use-cart.ts. Ganti toko =
// keranjang lama diganti. RLS buyer_carts/buyer_cart_items hanya
// mengizinkan pemiliknya sendiri, jadi action ini memakai client user
// (bukan service_role).
'use server'

import { createClient } from '@/lib/supabase/server'
import type { Product } from '@/lib/types'

export type BuyerCartLine = {
  productId: string
  qty: number
  product: Product
}

export type BuyerCart = {
  storeId: string | null
  storeSlug: string | null
  items: BuyerCartLine[]
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return { supabase, user }
}

/** Ambil keranjang tersimpan pembeli (beserta detail produknya). */
export async function getBuyerCartAction(): Promise<BuyerCart> {
  const auth = await requireUser()
  if (!auth) return { storeId: null, storeSlug: null, items: [] }
  const { supabase, user } = auth

  const { data: cart } = await supabase
    .from('buyer_carts')
    .select('id, store_id')
    .eq('buyer_id', user.id)
    .maybeSingle()
  if (!cart) return { storeId: null, storeSlug: null, items: [] }

  const { data: itemsData } = await supabase
    .from('buyer_cart_items')
    .select('product_id, qty')
    .eq('cart_id', (cart as { id: string }).id)
    .order('created_at', { ascending: true })
  const rows = (itemsData ?? []) as Array<{ product_id: string; qty: number }>
  if (rows.length === 0) {
    return { storeId: (cart as { store_id: string }).store_id, storeSlug: null, items: [] }
  }

  const { data: productsData } = await supabase
    .from('products')
    .select('id, name, slug, price, store_id, description, stock, available, images, badge')
    .in(
      'id',
      rows.map((r) => r.product_id)
    )
  const productById = new Map(
    ((productsData ?? []) as Product[]).map((p) => [p.id, p])
  )

  const items: BuyerCartLine[] = []
  for (const row of rows) {
    const product = productById.get(row.product_id)
    // Produk yang sudah dihapus penjual / tidak tersedia dilewati —
    // keranjang tersimpan tidak boleh menahan produk mati.
    if (!product || product.available === false) continue
    items.push({ productId: row.product_id, qty: row.qty, product })
  }

  let storeSlug: string | null = null
  const { data: store } = await supabase
    .from('stores')
    .select('slug')
    .eq('id', (cart as { store_id: string }).store_id)
    .maybeSingle()
  storeSlug = (store as { slug: string } | null)?.slug ?? null

  return { storeId: (cart as { store_id: string }).store_id, storeSlug, items }
}

/**
 * Timpa keranjang tersimpan dengan isi keranjang lokal.
 * Item kosong = hapus keranjang tersimpan. Produk yang tidak ada atau
 * bukan dari toko yang sama ditolak (satu keranjang = satu toko).
 */
export async function saveBuyerCartAction(input: {
  storeId: string
  items: Array<{ productId: string; qty: number }>
}): Promise<{ success: true } | { error: string }> {
  const auth = await requireUser()
  if (!auth) return { error: 'Kamu harus login untuk menyimpan keranjang.' }
  const { supabase, user } = auth

  const lines = input.items
    .map((i) => ({ productId: i.productId, qty: Math.max(1, Math.floor(Number(i.qty) || 1)) }))
    .filter((i) => i.productId)

  if (lines.length === 0) {
    await supabase.from('buyer_carts').delete().eq('buyer_id', user.id)
    return { success: true }
  }

  // Validasi: semua produk harus ada dan berasal dari toko yang sama.
  const { data: productsData, error: productsError } = await supabase
    .from('products')
    .select('id, store_id')
    .in(
      'id',
      lines.map((l) => l.productId)
    )
  if (productsError) return { error: 'Gagal memeriksa produk di keranjang.' }
  const found = (productsData ?? []) as Array<{ id: string; store_id: string }>
  if (found.length !== lines.length) {
    return { error: 'Ada produk di keranjang yang sudah tidak tersedia.' }
  }
  if (found.some((p) => p.store_id !== input.storeId)) {
    return { error: 'Keranjang hanya boleh berisi produk dari satu toko.' }
  }

  const { data: cart, error: cartError } = await supabase
    .from('buyer_carts')
    .upsert(
      { buyer_id: user.id, store_id: input.storeId },
      { onConflict: 'buyer_id' }
    )
    .select('id')
    .single()
  if (cartError || !cart) {
    return { error: 'Gagal menyimpan keranjang.' }
  }

  const cartId = (cart as { id: string }).id
  const { error: deleteError } = await supabase
    .from('buyer_cart_items')
    .delete()
    .eq('cart_id', cartId)
  if (deleteError) return { error: 'Gagal menyimpan keranjang.' }

  const { error: insertError } = await supabase.from('buyer_cart_items').insert(
    lines.map((l) => ({ cart_id: cartId, product_id: l.productId, qty: l.qty }))
  )
  if (insertError) return { error: 'Gagal menyimpan keranjang.' }

  return { success: true }
}

/** Hapus keranjang tersimpan (dipakai setelah checkout berhasil). */
export async function clearBuyerCartAction(): Promise<void> {
  const auth = await requireUser()
  if (!auth) return
  await auth.supabase.from('buyer_carts').delete().eq('buyer_id', auth.user.id)
}
