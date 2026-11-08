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

// Fase 2: ?type=buyer mendaftarkan akun pembeli (belanja + lacak
// pesanan), bukan penjual. Tanpa parameter → penjual seperti semula.
function readTypeFromUrl(): 'seller' | 'buyer' {
  if (typeof window === 'undefined') return 'seller'
  return new URLSearchParams(window.location.search).get('type') === 'buyer'
    ? 'buyer'
    : 'seller'
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
  const [accountType] = useState<'seller' | 'buyer'>(() => readTypeFromUrl())
  const isBuyer = accountType === 'buyer'

  // Simpan pilihan paket sekali saat halaman dibuka, sebelum user
  // sempat mendaftar lewat email maupun Google. Pembeli tidak punya
  // paket — jangan simpan cuan_plan untuk mereka.
  useEffect(() => {
    if (isBuyer) return
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

    // Pembeli: setelah verifikasi email, kembali ke akun pembeli.
    const emailRedirectTo = isBuyer
      ? `${location.origin}/auth/callback?next=/akun`
      : `${location.origin}/auth/callback`
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
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

    if (isBuyer) {
      // Cookie pengarah untuk middleware: pembeli baru belum punya baris
      // profiles, jadi peran belum bisa dibaca dari database.
      document.cookie = 'cuan_account_type=buyer; path=/; max-age=86400'
      router.push('/akun')
      return
    }
    router.push('/dashboard')
  }

  async function handleGoogle() {
    if (isBuyer) {
      document.cookie = 'cuan_account_type=buyer; path=/; max-age=86400'
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${location.origin}/auth/callback?next=/akun`,
        },
      })
      return
    }
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
      title={isBuyer ? 'Buat akun pembeli' : 'Buat akun penjual'}
      subtitle={
        isBuyer
          ? 'Belanja di toko UMKM dan lacak pesananmu dari satu akun'
          : 'Buat toko UMKM kamu sekarang — gratis'
      }
      footer={
        <p className="text-center text-sm text-neutral-500">
          Sudah punya akun?{' '}
          <Link href="/login" className="font-semibold text-[#0b6b4a] hover:text-[#084d3c]">
            Masuk
          </Link>
          {' · '}
          {isBuyer ? (
            <Link href="/register" className="font-semibold text-[#0b6b4a] hover:text-[#084d3c]">
              Daftar sebagai penjual
            </Link>
          ) : (
            <Link href="/register?type=buyer" className="font-semibold text-[#0b6b4a] hover:text-[#084d3c]">
              Daftar sebagai pembeli
            </Link>
          )}
        </p>
      }
    >
      <GoogleAuthButton label="Daftar dengan Google" onClick={handleGoogle} />
      <AuthOrDivider />

      {isBuyer ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Akun pembeli — keranjang tersimpan di akun, buku alamat, dan
          riwayat pesanan. Gratis, tanpa paket.
        </p>
      ) : (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Paket yang kamu pilih: <strong>{PLAN_COPY[plan]}</strong>
        </p>
      )}

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
