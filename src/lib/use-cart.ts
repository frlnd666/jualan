import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { CartItem, Product } from '@/lib/types'

interface CartStore {
  items: CartItem[]
  storeSlug: string | null
  storeId: string | null
  addItem: (product: Product, storeSlug: string, qty?: number) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, qty: number) => void
  clearCart: () => void
  subtotal: () => number
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      storeSlug: null,
      storeId: null,

      addItem: (product, storeSlug, qty = 1) => {
        const safeQty = Math.max(1, Math.floor(Number(qty) || 1))
        const productStoreId = product.store_id ?? null
        const { items, storeSlug: currentSlug, storeId: currentStoreId } = get()

        // Cart hanya boleh berisi produk dari SATU toko. Pindah toko =
        // cart lama diganti, dan identitas toko (slug + id) disimpan
        // eksplisit supaya checkout tidak perlu menebak store dari produk.
        const switchingStore =
          (currentSlug && currentSlug !== storeSlug) ||
          (currentStoreId && productStoreId && currentStoreId !== productStoreId)

        if (switchingStore) {
          set({
            items: [{ product, qty: safeQty }],
            storeSlug,
            storeId: productStoreId,
          })
          return
        }

        const existing = items.find((i) => i.product.id === product.id)

        if (existing) {
          set({
            items: items.map((i) =>
              i.product.id === product.id ? { ...i, qty: i.qty + safeQty } : i
            ),
            storeId: currentStoreId ?? productStoreId,
          })
        } else {
          set({
            items: [...items, { product, qty: safeQty }],
            storeSlug,
            storeId: productStoreId,
          })
        }
      },

      removeItem: (productId) =>
        set({ items: get().items.filter((i) => i.product.id !== productId) }),

      updateQty: (productId, qty) =>
        set({
          items:
            qty <= 0
              ? get().items.filter((i) => i.product.id !== productId)
              : get().items.map((i) =>
                  i.product.id === productId ? { ...i, qty } : i
                ),
        }),

      clearCart: () => set({ items: [], storeSlug: null, storeId: null }),

      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.product.price * i.qty, 0),
    }),
    {
      name: 'umkm-cart',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    }
  )
)
