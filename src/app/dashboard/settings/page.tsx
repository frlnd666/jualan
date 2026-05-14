'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uploadToCloudinary } from '@/lib/cloudinary'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [theme, setTheme] = useState('default')
  const [logoUrl, setLogoUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: store } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)
        setName(store.name)
        setSlug(store.slug)
        setDescription(store.description ?? '')
        setWhatsapp(store.whatsapp ?? '')
        setTheme(store.theme)
        setLogoUrl(store.logo_url ?? '')
        setBannerUrl(store.banner_url ?? '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleUpload(file: File, type: 'logo' | 'banner') {
    const url = await uploadToCloudinary(file)
    if (type === 'logo') setLogoUrl(url)
    else setBannerUrl(url)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      owner_id: user.id,
      name,
      slug: slug.toLowerCase().replace(/\s+/g, '-'),
      description,
      whatsapp,
      theme,
      logo_url: logoUrl,
      banner_url: bannerUrl,
    }

    if (storeId) {
      await supabase.from('stores').update(payload).eq('id', storeId)
    } else {
      const { data } = await supabase.from('stores').insert(payload).select().single()
      if (data) setStoreId(data.id)
    }

    setMessage('Toko berhasil disimpan')
    setSaving(false)
    router.refresh()
  }

  if (loading) return <div className="p-4 text-sm text-gray-500">Memuat...</div>

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Pengaturan Toko</h1>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nama Toko</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Kopi Sore"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug Toko</label>
          <input
            value={slug}
            onChange={e => setSlug(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="kopi-sore"
          />
          <p className="text-xs text-gray-400 mt-1">URL toko: platform.com/{slug}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Ceritakan tentang toko kamu"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nomor WhatsApp</label>
          <input
            value={whatsapp}
            onChange={e => setWhatsapp(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="08123456789"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tema</label>
          <select
            value={theme}
            onChange={e => setTheme(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="default">Default (Indigo)</option>
            <option value="warm">Warm (Amber)</option>
            <option value="minimal">Minimal (Slate)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
          <input
            type="file"
            accept="image/*"
            onChange={e => e.target.files && handleUpload(e.target.files[0], 'logo')}
            className="w-full text-sm text-gray-500"
          />
          {logoUrl && <img src={logoUrl} alt="logo" className="mt-2 h-12 rounded-lg object-cover" />}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Banner</label>
          <input
            type="file"
            accept="image/*"
            onChange={e => e.target.files && handleUpload(e.target.files[0], 'banner')}
            className="w-full text-sm text-gray-500"
          />
          {bannerUrl && <img src={bannerUrl} alt="banner" className="mt-2 w-full h-24 rounded-xl object-cover" />}
        </div>

        {message && <p className="text-green-600 text-sm">{message}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {saving ? 'Menyimpan...' : 'Simpan Toko'}
        </button>
      </form>
    </div>
  )
}