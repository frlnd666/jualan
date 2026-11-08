'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import AuthShell, {
  AuthOrDivider,
  GoogleAuthButton,
  authErrorClass,
  authInputClass,
  authLabelClass,
  authSubmitClass,
} from '@/components/auth/AuthShell'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Fase 2: pembeli masuk ke akun pembeli, bukan dashboard penjual.
    // Peran dibaca dari profiles; bila belum ada baris, fallback ke
    // cookie cuan_account_type (pembeli baru) lalu ke /dashboard.
    let destination = '/dashboard'
    try {
      const userId = data.user?.id
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle()
        if (profile?.role === 'buyer') destination = '/akun'
      }
      if (destination === '/dashboard') {
        const accountType = document.cookie
          .split(';')
          .map((c) => c.trim())
          .find((c) => c.startsWith('cuan_account_type='))
          ?.split('=')[1]
        if (accountType === 'buyer') destination = '/akun'
      }
    } catch {}
    router.push(destination)
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  return (
    <AuthShell
      title="Selamat datang kembali"
      subtitle="Masuk untuk mengelola toko UMKM kamu"
      footer={
        <p className="text-center text-sm text-neutral-500">
          Belum punya akun?{' '}
          <Link href="/register" className="font-semibold text-[#0b6b4a] hover:text-[#084d3c]">
            Daftar gratis
          </Link>
          {' · '}
          <Link href="/register?type=buyer" className="font-semibold text-[#0b6b4a] hover:text-[#084d3c]">
            Daftar sebagai pembeli
          </Link>
        </p>
      }
    >
      <GoogleAuthButton label="Masuk dengan Google" onClick={handleGoogle} />
      <AuthOrDivider />

      <form onSubmit={handleLogin} className="space-y-4">
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

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-medium text-neutral-700">Password</label>
            <Link href="/forgot-password" className="text-xs font-semibold text-[#0b6b4a] hover:text-[#084d3c]">
              Lupa password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className={`${authInputClass} pr-11`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-semibold text-neutral-400 hover:text-neutral-600"
            >
              {showPassword ? 'Tutup' : 'Lihat'}
            </button>
          </div>
        </div>

        {error ? <p className={authErrorClass}>{error}</p> : null}

        <button type="submit" disabled={loading} className={authSubmitClass}>
          {loading ? 'Memproses...' : 'Masuk'}
        </button>
      </form>
    </AuthShell>
  )
}
