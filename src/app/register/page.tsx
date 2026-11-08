'use client'

import { useState, useEffect } from 'react'
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

import {
  REGISTER_PLAN_KEY,
  type RegisterPlan,
} from '@/lib/register-plan'

const PLAN_COPY: Record<RegisterPlan, string> = {
  free: 'Paket Free — 4 produk, pembayaran COD saja.',
  'silver-trial': 'Trial Silver 14 hari — semua fitur Silver, gratis. Tanpa kartu kredit.',
  gold: 'Paket Gold — setelah daftar, kamu diarahkan ke pembayaran manual (QRIS/transfer) untuk mengaktifkan Gold.',
}

function readPlanFromUrl(): RegisterPlan {
  if (typeof window === 'undefined') return 'free'
  const plan = new URLSearchParams(window.location.search).get('plan')
  if (plan === 'silver-trial' || plan === 'gold') return plan
  return 'free'
}

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [plan] = useState<RegisterPlan>(() => readPlanFromUrl())

  // Simpan pilihan paket sekali saat halaman dibuka, sebelum user
  // sempat mendaftar lewat email maupun Google.
  useEffect(() => {
    try {
      window.localStorage.setItem(REGISTER_PLAN_KEY, plan)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Bila konfirmasi email aktif di Supabase, signUp tidak menghasilkan
    // sesi. Dulu kode langsung push ke /dashboard dan user terpental ke
    // /login tanpa penjelasan.
    if (!data.session) {
      setInfo(
        'Pendaftaran berhasil. Cek email kamu untuk tautan verifikasi, lalu masuk dengan akun yang baru dibuat.'
      )
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  async function handleGoogle() {
    try {
      window.localStorage.setItem(REGISTER_PLAN_KEY, plan)
    } catch {}
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  return (
    <AuthShell
      title="Buat akun penjual"
      subtitle="Buat toko UMKM kamu sekarang — gratis"
      footer={
        <p className="text-center text-sm text-neutral-500">
          Sudah punya akun?{' '}
          <Link href="/login" className="font-semibold text-[#0b6b4a] hover:text-[#084d3c]">
            Masuk
          </Link>
        </p>
      }
    >
      <GoogleAuthButton label="Daftar dengan Google" onClick={handleGoogle} />
      <AuthOrDivider />

      <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Paket yang kamu pilih: <strong>{PLAN_COPY[plan]}</strong>
      </p>

      <form onSubmit={handleRegister} className="space-y-4">
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
          <label className={authLabelClass}>Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className={`${authInputClass} pr-11`}
              placeholder="Minimal 6 karakter"
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
        {info ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{info}</p>
        ) : null}

        <button type="submit" disabled={loading} className={authSubmitClass}>
          {loading ? 'Memproses...' : 'Daftar sekarang'}
        </button>
      </form>
    </AuthShell>
  )
}
