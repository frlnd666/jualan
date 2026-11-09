// Tombol hapus produk (client) — dipakai halaman daftar produk.
// P2-20: konfirmasi dulu lewat confirm() bawaan browser; hasil (sukses
// maupun error) tampil inline di bawah tombol. Produk yang sudah pernah
// dipesan ditolak server action-nya dengan pesan yang jelas.
'use client'

import { useState, useTransition } from 'react'
import { deleteProductAction } from '@/lib/actions/subscriptions'

export default function ProductDeleteButton({
  productId,
  productName,
}: {
  productId: string
  productName: string
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (
            !window.confirm(
              `Hapus produk "${productName}" secara permanen? Produk yang sudah pernah dipesan tidak bisa dihapus.`
            )
          ) {
            return
          }
          startTransition(async () => {
            setMessage(null)
            try {
              const result = await deleteProductAction({ productId })
              if ('error' in result) setMessage(result.error)
            } catch {
              // P2-13: action melempar (mis. jaringan putus) — jangan
              // biarkan error naik ke error boundary; tampilkan inline.
              setMessage('Gagal menghapus produk. Periksa koneksi lalu coba lagi.')
            }
          })
        }}
        className="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Menghapus...' : 'Hapus'}
      </button>
      {message ? (
        <span className="mt-2 text-xs font-medium text-red-700">{message}</span>
      ) : null}
    </span>
  )
}
