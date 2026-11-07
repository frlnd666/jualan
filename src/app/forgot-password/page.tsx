'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import AuthShell, {
  authErrorClass,
  authInputClass,
  authLabelClass,
  authSubmitClass,
} from '@/components/auth/AuthShell'

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
    <AuthShell
      title="Lupa password"
      subtitle="Masukkan email akun kamu, kami kirimkan tautan untuk membuat password baru."
      footer={
        <p className="text-center text-sm text-neutral-500">
          <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
            ← Kembali masuk
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Jika email tersebut terdaftar, tautan reset password sudah dikirim.
            Cek inbox (dan folder spam) kamu.
          </p>
          <Link href="/login" className={`${authSubmitClass} block text-center`}>
            Kembali masuk
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={authLabelClass}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={authInputClass}
              placeholder="email@kamu.com"
            />
          </div>

          {error ? <p className={authErrorClass}>{error}</p> : null}

          <button type="submit" disabled={loading} className={authSubmitClass}>
            {loading ? 'Mengirim...' : 'Kirim tautan reset'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
