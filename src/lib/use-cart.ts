import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { CartItem, Product } from '@/lib/types'

interface CartStore {
  items: CartItem[]
  storeSlug: string | null
  addItem: (product: Product, storeSlug: string) => void
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

      addItem: (product, storeSlug) => {
        const { items, storeSlug: current } = get()

        if (current && current !== storeSlug) {
          set({ items: [{ product, qty: 1 }], storeSlug })
          return
        }

        const existing = items.find((i) => i.product.id === product.id)

        if (existing) {
          set({
            items: items.map((i) =>
              i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i
            ),
          })
        } else {
          set({ items: [...items, { product, qty: 1 }], storeSlug })
        }
      },

      removeItem: (productId) =>
        set({ items: get().items.filter((i) => i.product.id !== productId) }),

      updateQty: (productId, qty) =>
        set({
          items:
            qty === 0
              ? get().items.filter((i) => i.product.id !== productId)
              : get().items.map((i) =>
                  i.product.id === productId ? { ...i, qty } : i
                ),
        }),

      clearCart: () => set({ items: [], storeSlug: null }),

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