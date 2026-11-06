'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    async function check() {
      // Sesi recovery dibuat oleh /auth/callback setelah tautan email diklik.
      const { data: { session } } = await supabase.auth.getSession()
      setHasSession(Boolean(session))
      setChecking(false)
    }
    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password minimal 6 karakter.')
      return
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak sama.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setDone(true)
    setTimeout(() => router.push('/dashboard'), 1200)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Password baru</h1>
        <p className="text-sm text-gray-500 mb-6">Buat password baru untuk akun kamu.</p>

        {checking ? (
          <p className="text-sm text-gray-500">Memeriksa tautan reset...</p>
        ) : !hasSession ? (
          <div className="space-y-4">
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru
              dari halaman lupa password.
            </p>
            <Link
              href="/forgot-password"
              className="block w-full bg-indigo-600 text-white rounded-xl py-3 text-center text-sm font-semibold hover:bg-indigo-700 transition"
            >
              Minta tautan baru
            </Link>
          </div>
        ) : done ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Password berhasil diubah. Mengalihkan ke dashboard...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password baru</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="min. 6 karakter"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="ulangi password baru"
              />
            </div>

            {error && <p className="text-red-500 text-xs">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Simpan password baru'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
