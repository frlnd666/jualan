'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { removeProductImageObject } from '@/lib/product-image'

type EditProductPageProps = {
  params: Promise<{
    id: string
  }>
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
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

  const objectUrlRef = useRef<string | null>(null)

  function setLocalPreview(file: File) {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
    }
    const objectUrl = URL.createObjectURL(file)
    objectUrlRef.current = objectUrl
    setImagePreview(objectUrl)
  }

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

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

    setLocalPreview(file)

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

  async function handleRemoveImage() {
    setErrorMessage('')
    setSuccessMessage('')
    // Hapus objek dari storage (best-effort) lalu kosongkan referensinya;
    // perubahan tersimpan permanen saat seller menekan Simpan.
    await removeProductImageObject(supabase, imageUrl)
    setImageUrl('')
    setImagePreview('')
    setImageFile(null)
    setSuccessMessage('Foto produk dihapus. Tekan Simpan untuk menerapkan.')
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
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--text-muted)]">
            Edit produk
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">
            {name || 'Produk'}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Perbarui informasi produk, stok, status, dan foto utama.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push('/dashboard/products')}
          className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-soft)]"
        >
          Kembali
        </button>
      </div>

      {errorMessage ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
        <h2 className="text-base font-bold text-[var(--text)]">
          Informasi produk
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Data ini tampil di halaman produk dan daftar katalog toko.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--text)]">
              Nama produk
            </span>
            <input
              value={name}
              onChange={(e) => {
                const nextName = e.target.value
                setName(nextName)
                if (!slug.trim()) setSlug(toSlug(nextName))
              }}
              className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
              placeholder="Nama produk"
              disabled={loadingPage}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--text)]">
              Slug produk
            </span>
            <input
              value={slug}
              onChange={(e) => setSlug(toSlug(e.target.value))}
              className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
              placeholder="slug-produk"
              disabled={loadingPage}
            />
            <span className="mt-2 block text-xs text-[var(--text-muted)]">
              Dipakai untuk URL produk. Gunakan huruf kecil dan tanda hubung.
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--text)]">
                Harga
              </span>
              <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 focus-within:border-[var(--primary)]">
                <div className="flex items-center">
                  <span className="mr-3 text-sm font-semibold text-[var(--text-muted)]">
                    Rp
                  </span>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))}
                    className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
                    placeholder="15000"
                    inputMode="numeric"
                    disabled={loadingPage}
                  />
                </div>
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--text)]">
                Stok
              </span>
              <input
                value={stock}
                onChange={(e) => setStock(e.target.value.replace(/[^\d]/g, ''))}
                className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
                placeholder="0"
                inputMode="numeric"
                disabled={loadingPage}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--text)]">
              Deskripsi
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
              rows={5}
              placeholder="Deskripsi"
              disabled={loadingPage}
            />
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-[var(--surface-soft)] px-4 py-3">
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
              disabled={loadingPage}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium text-[var(--text)]">
              Produk aktif dan tampil di toko
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
        <h2 className="text-base font-bold text-[var(--text)]">Foto produk</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Upload foto baru jika ingin mengganti gambar utama produk.
        </p>

        <div className="mt-5 space-y-4">
          <label
            htmlFor="product-image"
            className="flex cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-[var(--line)] bg-[var(--surface-soft)] px-5 py-8 text-center transition hover:border-[var(--primary)]"
          >
            <span className="text-sm font-semibold text-[var(--text)]">
              {uploadingImage ? 'Mengupload gambar...' : 'Pilih foto produk'}
            </span>
            <span className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
              Format JPG, PNG, WEBP.
            </span>
            <span className="mt-4 inline-flex rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white">
              Pilih file
            </span>
          </label>

          <input
            id="product-image"
            name="product-image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
            className="hidden"
            disabled={loadingPage}
          />

          <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text-muted)]">
            {imageFile
              ? `File dipilih: ${imageFile.name}`
              : 'Belum ada file baru yang dipilih.'}
          </div>

          {imagePreview ? (
            <div className="space-y-2">
              <div className="overflow-hidden rounded-[28px] border border-[var(--line)] bg-white">
                <img
                  src={imagePreview}
                  alt="Preview foto produk"
                  className="h-56 w-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
              >
                Hapus foto
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <div className="sticky bottom-20 z-10 rounded-[28px] border border-[var(--line)] bg-[var(--surface)]/95 p-4 shadow-[var(--shadow-md)] backdrop-blur">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard/products')}
            className="inline-flex items-center justify-center rounded-2xl border border-[var(--line)] bg-white px-5 py-3 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-soft)]"
            disabled={submitting}
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loadingPage || uploadingImage || submitting}
            className="inline-flex flex-1 items-center justify-center rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
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
