'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

function sanitizeNumberInput(value: string) {
  return value.replace(/D/g, '')
}

function parseNumberInput(value: string) {
  return Number(value || 0)
}

function formatRupiahPreview(value: string) {
  if (!value) return '0'
  return Number(value).toLocaleString('id-ID')
}

function generateSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9s-]/g, '')
    .replace(/s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function NewProductPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('0')
  const [description, setDescription] = useState('')

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  const [storeId, setStoreId] = useState('')
  const [loadingStore, setLoadingStore] = useState(true)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    async function loadStore() {
      setLoadingStore(true)
      setErrorMessage('')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setErrorMessage('Kamu harus login untuk menambahkan produk.')
        setLoadingStore(false)
        return
      }

      const { data: store, error } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (error || !store) {
        setErrorMessage('Toko tidak ditemukan untuk akun ini.')
        setLoadingStore(false)
        return
      }

      setStoreId(store.id)
      setLoadingStore(false)
    }

    loadStore()
  }, [supabase])

  useEffect(() => {
    if (!imageFile) {
      setImagePreview('')
      return
    }

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
    setImageUrl('')
    setImageFile(file)

    if (!file) return

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
      setSuccessMessage('Foto produk berhasil diupload.')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal upload foto produk.'
      setErrorMessage(message)
      setImageFile(null)
      setImageUrl('')
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

    if (!name.trim()) {
      setErrorMessage('Nama produk wajib diisi.')
      return
    }

    if (!slug.trim()) {
      setErrorMessage('Slug produk wajib diisi.')
      return
    }

    if (!price.trim() || parseNumberInput(price) <= 0) {
      setErrorMessage('Harga produk harus lebih dari 0.')
      return
    }

    if (uploadingImage) {
      setErrorMessage('Tunggu upload gambar selesai terlebih dahulu.')
      return
    }

    try {
      setSubmitting(true)

      const { error } = await supabase.from('products').insert({
        store_id: storeId,
        name: name.trim(),
        slug: slug.trim(),
        price: parseNumberInput(price),
        stock: parseNumberInput(stock),
        description: description.trim(),
        images: imageUrl ? [imageUrl] : [],
        available: true,
      })

      if (error) {
        if (error.message?.toLowerCase().includes('duplicate')) {
          throw new Error('Slug produk sudah dipakai. Gunakan slug lain.')
        }

        throw error
      }

      router.push('/dashboard/products')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal menyimpan produk.'
      setErrorMessage(message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleNameChange(value: string) {
    const nextSlug = generateSlug(value)

    setName(value)

    if (!slug.trim() || slug === generateSlug(name)) {
      setSlug(nextSlug)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--text-muted)]">
            Produk baru
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">
            Tambah Produk
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Lengkapi informasi utama produk, upload foto, lalu simpan agar produk
            tampil di toko.
          </p>
        </div>

        <Link
          href="/dashboard/products"
          className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-soft)]"
        >
          Kembali
        </Link>
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--text)]">
              Informasi produk
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Data ini akan tampil di halaman produk dan daftar katalog toko.
            </p>
          </div>

          <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Wajib
          </span>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--text)]">
              Nama produk
            </span>
            <input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
              placeholder="Contoh: Kopi Susu Gula Aren"
              disabled={loadingStore || submitting}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--text)]">
              Slug produk
            </span>
            <input
              value={slug}
              onChange={(e) => setSlug(generateSlug(e.target.value))}
              className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
              placeholder="kopi-susu-gula-aren"
              disabled={loadingStore || submitting}
            />
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Dipakai untuk URL produk. Gunakan huruf kecil dan tanda hubung.
            </p>
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
                    onChange={(e) => setPrice(sanitizeNumberInput(e.target.value))}
                    className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
                    placeholder="15000"
                    inputMode="numeric"
                    disabled={loadingStore || submitting}
                  />
                </div>

                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Preview: Rp {formatRupiahPreview(price)}
                </p>
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--text)]">
                Stok awal
              </span>
              <input
                value={stock}
                onChange={(e) => setStock(sanitizeNumberInput(e.target.value))}
                className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]"
                placeholder="0"
                inputMode="numeric"
                disabled={loadingStore || submitting}
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
              placeholder="Jelaskan rasa, ukuran, bahan utama, atau info penting lain tentang produk ini."
              disabled={loadingStore || submitting}
            />
          </label>
        </div>
      </section>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--text)]">
              Foto produk
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Upload satu foto utama agar produk lebih menarik saat dilihat customer.
            </p>
          </div>

          <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Opsional
          </span>
        </div>

        <div className="mt-5 space-y-4">
          <label
            htmlFor="product-image"
            className="flex cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-[var(--line)] bg-[var(--surface-soft)] px-5 py-8 text-center transition hover:border-[var(--primary)]"
          >
            <span className="text-sm font-semibold text-[var(--text)]">
              {uploadingImage ? 'Mengupload gambar...' : 'Pilih foto produk'}
            </span>
            <span className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
              Format JPG, PNG, WEBP. Maksimal 2MB.
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
            disabled={loadingStore || uploadingImage || submitting}
          />

          <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text-muted)]">
            {imageFile
              ? `File dipilih: ${imageFile.name}`
              : 'Belum ada file yang dipilih.'}
          </div>

          {imagePreview ? (
            <div className="overflow-hidden rounded-[28px] border border-[var(--line)] bg-white">
              <img
                src={imagePreview}
                alt="Preview foto produk"
                className="h-56 w-full object-cover"
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[32px] border border-amber-200 bg-amber-50 p-5 shadow-[var(--shadow-sm)] md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-amber-900">
              Pengiriman toko
            </h2>
            <p className="mt-1 text-sm text-amber-800">
              Metode ekspedisi tidak diatur per produk. Atur sekali di level toko
              agar otomatis muncul saat checkout.
            </p>
          </div>

          <Link
            href="/dashboard/shipping"
            className="inline-flex items-center justify-center rounded-2xl border border-amber-300 bg-white px-4 py-3 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
          >
            Atur ekspedisi
          </Link>
        </div>
      </section>

      <div className="sticky bottom-20 z-10 rounded-[28px] border border-[var(--line)] bg-[var(--surface)]/95 p-4 shadow-[var(--shadow-md)] backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">
              Siap simpan produk baru
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Pastikan nama, slug, harga, dan stok sudah benar.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loadingStore || uploadingImage || submitting}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {loadingStore
              ? 'Memuat toko...'
              : uploadingImage
              ? 'Mengupload gambar...'
              : submitting
              ? 'Menyimpan produk...'
              : 'Simpan Produk'}
          </button>
        </div>
      </div>
    </div>
  )
}