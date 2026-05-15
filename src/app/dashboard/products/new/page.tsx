'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uploadToCloudinary } from '@/lib/cloudinary'
import { useRouter } from 'next/navigation'

export default function NewProductPage() {
  const supabase = createClient()
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('0')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [storeId, setStoreId] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).single()
      if (store) setStoreId(store.id)
    })()
  }, [])

  async function handleSubmit() {
    if (!storeId) return
    await supabase.from('products').insert({
      store_id: storeId,
      name,
      slug,
      price: Number(price),
      stock: Number(stock),
      description,
      images: imageUrl ? [imageUrl] : [],
      available: true,
    })
    router.push('/dashboard/products')
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-6">Tambah Produk</h1>
      <div className="space-y-4">
        <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm" placeholder="Nama produk" />
        <input value={slug} onChange={e => setSlug(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm" placeholder="slug-produk" />
        <input value={price} onChange={e => setPrice(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm" placeholder="Harga" />
        <input value={stock} onChange={e => setStock(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm" placeholder="Stok" />
        <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm" rows={4} placeholder="Deskripsi" />
        <input type="file" accept="image/*" onChange={async e => { if (e.target.files?.[0]) setImageUrl(await uploadToCloudinary(e.target.files[0])) }} className="w-full text-sm" />
        <button onClick={handleSubmit} className="w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold">Simpan Produk</button>
      </div>
    </div>
  )
}