'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type EditProductPageProps = {
  params: Promise<{
    id: string
  }>
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9s-]/g, '')
    .replace(/s+/g, '-')
    .replace(/-+/g, '-')
}

export default function EditProductPage({ params }: EditProductPageProps) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [productId, setProductId] = useState('')
  const [storeId, setStoreId] = useState('')

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('0')
  const [description, setDescription] = useState('')
  const [available, setAvailable] = useState(true)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  const [loadingPage, setLoadingPage] = useState(true)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    async function bootstrap() {
      try {
        setLoadingPage(true)

        const resolvedParams = await params
        const currentProductId = resolvedParams.id
        setProductId(currentProductId)

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setErrorMessage('Kamu harus login untuk mengelola produk.')
          setLoadingPage(false)
          return
        }

        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('id')
          .eq('owner_id', user.id)
          .single()

        if (storeError || !store) {
          setErrorMessage('Toko tidak ditemukan untuk akun ini.')
          setLoadingPage(false)
          return
        }

        setStoreId(store.id)

        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id, store_id, name, slug, price, stock, description, available, images')
          .eq('id', currentProductId)
          .eq('store_id', store.id)
          .single()

        if (productError || !product) {
          setErrorMessage('Produk tidak ditemukan.')
          setLoadingPage(false)
          return
        }

        setName(product.name || '')
        setSlug(product.slug || '')
        setPrice(String(product.price ?? ''))
        setStock(String(product.stock ?? 0))
        setDescription(product.description || '')
        setAvailable(Boolean(product.available))
        setImageUrl(product.images?.[0] || '')
        setImagePreview(product.images?.[0] || '')
      } catch {
        setErrorMessage('Gagal memuat data produk.')
      } finally {
        setLoadingPage(false)
      }
    }

    bootstrap()
  }, [params, supabase])

  useEffect(() => {
    if (!imageFile) return

    const objectUrl = URL.createObjectURL(imageFile)
    setImagePreview(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [imageFile])

  async function uploadProductImage(file: File) {
    const fileExt = file.name.split('.').pop() || 'jpg'
    const safeSlug = slug.trim() || `product-${Date.now()}`
    const fileName = `${safeSlug}-${Date.now()}.${fileExt}`
    const filePath = `products/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      throw new Error('Gagal upload foto produk ke storage.')
    }

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath)

    return data.publicUrl
  }

  async function handleImageChange(file: File | null) {
    setErrorMessage('')
    setSuccessMessage('')
    setImageFile(file)

    if (!file) {
      setImagePreview(imageUrl || '')
      return
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('File harus berupa JPG, PNG, atau WEBP.')
      setImageFile(null)
      return
    }

    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) {
      setErrorMessage('Ukuran file maksimal 2MB.')
      setImageFile(null)
      return
    }

    try {
      setUploadingImage(true)
      const uploadedUrl = await uploadProductImage(file)
      setImageUrl(uploadedUrl)
      setImagePreview(uploadedUrl)
      setSuccessMessage('Foto produk berhasil diupload.')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal upload foto produk.'
      setErrorMessage(message)
      setImageFile(null)
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleSubmit() {
    setErrorMessage('')
    setSuccessMessage('')

    if (!storeId) {
      setErrorMessage('Store tidak ditemukan.')
      return
    }

    if (!productId) {
      setErrorMessage('Produk tidak valid.')
      return
    }

    if (!name.trim()) {
      setErrorMessage('Nama produk wajib diisi.')
      return
    }

    if (!slug.trim()) {
      setErrorMessage('Slug produk wajib diisi.')
      return
    }

    if (!price.trim() || Number(price) <= 0) {
      setErrorMessage('Harga produk harus lebih dari 0.')
      return
    }

    if (uploadingImage) {
      setErrorMessage('Tunggu upload gambar selesai terlebih dahulu.')
      return
    }

    try {
      setSubmitting(true)

      const { error } = await supabase
        .from('products')
        .update({
          name: name.trim(),
          slug: slug.trim(),
          price: Number(price),
          stock: Number(stock || 0),
          description: description.trim(),
          available,
          images: imageUrl ? [imageUrl] : [],
        })
        .eq('id', productId)
        .eq('store_id', storeId)

      if (error) throw error

      router.push('/dashboard/products')
    } catch {
      setErrorMessage('Gagal memperbarui produk.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-4">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Edit Produk</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Perbarui informasi produk, stok, status, dan foto utama.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push('/dashboard/products')}
          className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700"
        >
          Kembali
        </button>
      </div>

      {errorMessage ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-neutral-800">
            Nama produk
          </label>
          <input
            value={name}
            onChange={(e) => {
              const nextName = e.target.value
              setName(nextName)
              if (!slug.trim()) setSlug(toSlug(nextName))
            }}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-indigo-500"
            placeholder="Nama produk"
            disabled={loadingPage}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-neutral-800">
            Slug produk
          </label>
          <input
            value={slug}
            onChange={(e) => setSlug(toSlug(e.target.value))}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-indigo-500"
            placeholder="slug-produk"
            disabled={loadingPage}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-neutral-800">
              Harga
            </label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^d]/g, ''))}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-indigo-500"
              placeholder="Harga"
              inputMode="numeric"
              disabled={loadingPage}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-neutral-800">
              Stok
            </label>
            <input
              value={stock}
              onChange={(e) => setStock(e.target.value.replace(/[^d]/g, ''))}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-indigo-500"
              placeholder="Stok"
              inputMode="numeric"
              disabled={loadingPage}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-neutral-800">
            Deskripsi
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-indigo-500"
            rows={5}
            placeholder="Deskripsi"
            disabled={loadingPage}
          />
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
            disabled={loadingPage}
          />
          <span className="text-sm font-medium text-neutral-800">
            Produk aktif dan tampil di toko
          </span>
        </label>

        <div className="space-y-2">
          <label
            htmlFor="product-image"
            className="block text-sm font-semibold text-neutral-800"
          >
            Foto produk
          </label>

          <input
            id="product-image"
            name="product-image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
            className="block w-full cursor-pointer rounded-2xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-600 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-600 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700 focus:outline-none"
            disabled={loadingPage}
          />

          <p className="text-xs text-neutral-500">
            {imageFile
              ? `File dipilih: ${imageFile.name}`
              : 'Upload foto baru jika ingin mengganti gambar utama produk.'}
          </p>
        </div>

        {imagePreview ? (
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <img
              src={imagePreview}
              alt="Preview foto produk"
              className="h-52 w-full object-cover"
            />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard/products')}
            className="w-full rounded-xl border border-neutral-200 bg-white py-3 font-semibold text-neutral-700"
            disabled={submitting}
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loadingPage || uploadingImage || submitting}
            className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingPage
              ? 'Memuat produk...'
              : uploadingImage
              ? 'Mengupload gambar...'
              : submitting
              ? 'Menyimpan...'
              : 'Simpan perubahan'}
          </button>
        </div>
      </div>
    </div>
  )
}