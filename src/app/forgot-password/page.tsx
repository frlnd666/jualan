'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    // Pesan sengaja generik: tidak membocorkan apakah email terdaftar.
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Lupa password</h1>
        <p className="text-sm text-gray-500 mb-6">
          Masukkan email akun kamu, kami kirimkan tautan untuk membuat password baru.
        </p>

        {sent ? (
          <div className="space-y-4">
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Jika email tersebut terdaftar, tautan reset password sudah dikirim.
              Cek inbox (dan folder spam) kamu.
            </p>
            <Link
              href="/login"
              className="block w-full bg-indigo-600 text-white rounded-xl py-3 text-center text-sm font-semibold hover:bg-indigo-700 transition"
            >
              Kembali masuk
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="email@kamu.com"
              />
            </div>

            {error && <p className="text-red-500 text-xs">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? 'Mengirim...' : 'Kirim tautan reset'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link href="/login" className="text-indigo-600 font-medium">← Kembali masuk</Link>
        </p>
      </div>
    </div>
  )
}
