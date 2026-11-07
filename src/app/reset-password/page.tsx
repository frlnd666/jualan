'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import AuthShell, {
  authErrorClass,
  authInputClass,
  authLabelClass,
  authSubmitClass,
} from '@/components/auth/AuthShell'

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
    <AuthShell title="Password baru" subtitle="Buat password baru untuk akun kamu.">
      {checking ? (
        <p className="text-sm text-neutral-500">Memeriksa tautan reset...</p>
      ) : !hasSession ? (
        <div className="space-y-4">
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru
            dari halaman lupa password.
          </p>
          <Link href="/forgot-password" className={`${authSubmitClass} block text-center`}>
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
            <label className={authLabelClass}>Password baru</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className={authInputClass}
              placeholder="Minimal 6 karakter"
            />
          </div>
          <div>
            <label className={authLabelClass}>Konfirmasi password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className={authInputClass}
              placeholder="Ulangi password baru"
            />
          </div>

          {error ? <p className={authErrorClass}>{error}</p> : null}

          <button type="submit" disabled={loading} className={authSubmitClass}>
            {loading ? 'Menyimpan...' : 'Simpan password baru'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
