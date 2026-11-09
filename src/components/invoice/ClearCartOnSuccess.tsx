'use client'

import { useEffect, useRef } from 'react'
import { useCart } from '@/lib/use-cart'

/**
 * Bersihkan keranjang lokal SETELAH pesanan berhasil dibuat.
 *
 * Dipasang di halaman invoice hanya saat ?baru=1 (tiba dari redirect
 * checkout sukses). Alasan: redirect() di akhir createOrderAction
 * meng-abort eksekusi, jadi clearCart() tidak boleh dilakukan di
 * halaman checkout — SEBELUM await membuat halaman langsung
 * menampilkan "Cart masih kosong" selama action berjalan (8-13 dtk)
 * dan SESUDAH await tidak pernah jalan. Halaman invoice hanya
 * tercapai bila pesanan SUDAH terbentuk, jadi di sinilah tempat
 * yang aman untuk membersihkan keranjang.
 */
export default function ClearCartOnSuccess() {
  const cleared = useRef(false)

  useEffect(() => {
    if (cleared.current) return
    cleared.current = true
    useCart.getState().clearCart()
  }, [])

  return null
}
