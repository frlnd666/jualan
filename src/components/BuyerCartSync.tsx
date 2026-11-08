// Sinkronisasi keranjang pembeli (Fase 2, 'use client').
// Dipasang sekali di root layout; diam untuk tamu (tidak login).
//
// Perilaku:
// - Saat pembeli login: muat keranjang tersimpan dari akun. Bila
//   keranjang lokal (perangkat ini) kosong → pakai keranjang akun.
//   Bila keranjang lokal ada isinya → lokal menang, lalu didorong
//   ke server (lihat resolveCartOnLogin di lib/access-rules.ts).
// - Selama pembeli login: setiap perubahan keranjang lokal didorong
//   ke server (debounce 800ms) supaya keranjang bisa dibuka kembali
//   dari perangkat lain.
// - Saat logout: sinkronisasi berhenti; keranjang lokal tetap ada.
'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/lib/use-cart'
import { resolveCartOnLogin } from '@/lib/access-rules'
import {
  getBuyerCartAction,
  saveBuyerCartAction,
} from '@/lib/actions/buyer-cart'

export default function BuyerCartSync() {
  const syncedForUserId = useRef<string | null>(null)
  const suppressSave = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function initialSync(userId: string) {
      if (syncedForUserId.current === userId) return
      syncedForUserId.current = userId

      // Pastikan keranjang localStorage sudah terhidrasi sebelum dibaca.
      try {
        await useCart.persist.rehydrate()
      } catch {}

      const server = await getBuyerCartAction()
      if (cancelled) return

      const localItems = useCart
        .getState()
        .items.map((i) => ({ productId: i.product.id, qty: i.qty }))
      const resolved = resolveCartOnLogin(localItems, server.items)

      if (resolved.source === 'server') {
        suppressSave.current = true
        useCart.getState().loadItems(
          server.items.map((i) => ({ product: i.product, qty: i.qty })),
          server.storeSlug,
          server.storeId
        )
        window.setTimeout(() => {
          suppressSave.current = false
        }, 0)
      } else if (resolved.source === 'local') {
        const state = useCart.getState()
        if (state.storeId) {
          await saveBuyerCartAction({
            storeId: state.storeId,
            items: localItems,
          })
        }
      }
    }

    async function checkSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (user) void initialSync(user.id)
      else syncedForUserId.current = null
    }

    void checkSession()
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled) return
        if (session?.user) void initialSync(session.user.id)
        else syncedForUserId.current = null
      }
    )

    // Dorong perubahan keranjang lokal ke server (debounce).
    const unsubscribe = useCart.subscribe((state) => {
      if (suppressSave.current) return
      if (!syncedForUserId.current) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        if (!state.storeId) return
        void saveBuyerCartAction({
          storeId: state.storeId,
          items: state.items.map((i) => ({
            productId: i.product.id,
            qty: i.qty,
          })),
        })
      }, 800)
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
      unsubscribe()
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  return null
}
