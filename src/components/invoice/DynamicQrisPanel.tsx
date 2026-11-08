// Panel QRIS dinamis di halaman invoice (Fase 3) — Client Component.
// - Menampilkan QR (dirender dari qrContent via lib qrcode) + nominal
//   terkunci + hitung mundur masa berlaku (20 menit).
// - Polling status tiap 5 detik ke /api/qris/status: bila PAID, halaman
//   dimuat ulang otomatis; bila EXPIRED, tampil tombol buat QR baru.
// - Bila toko belum mengaktifkan QRIS dinamis (manualFallback), panel
//   ini tidak tampil — pembeli memakai alur manual lama (upload bukti)
//   yang sudah ada di halaman ini.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { generateDynamicQrAction } from '@/lib/actions/qris'

type PanelState =
  | { kind: 'loading' }
  | { kind: 'ready'; qrContent: string; expiresAt: string }
  | { kind: 'expired' }
  | { kind: 'manual'; message: string }

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export default function DynamicQrisPanel({
  invoiceNumber,
  token,
  initialQrContent,
  initialExpiresAt,
  amount,
}: {
  invoiceNumber: string
  token: string | null
  initialQrContent: string | null
  initialExpiresAt: string | null
  amount: number
}) {
  const router = useRouter()
  const [state, setState] = useState<PanelState>(() =>
    initialQrContent && initialExpiresAt
      ? { kind: 'ready', qrContent: initialQrContent, expiresAt: initialExpiresAt }
      : { kind: 'loading' }
  )
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Generate QR saat pertama dibuka bila belum ada QR aktif.
  useEffect(() => {
    if (initialQrContent && initialExpiresAt) return
    let cancelled = false
    generateDynamicQrAction(invoiceNumber, token)
      .then((result) => {
        if (cancelled || !mountedRef.current) return
        if (result.ok && result.qrContent && result.expiresAt) {
          setState({
            kind: 'ready',
            qrContent: result.qrContent,
            expiresAt: result.expiresAt,
          })
        } else if (result.manualFallback) {
          setState({
            kind: 'manual',
            message: result.error ?? 'QRIS dinamis belum aktif untuk toko ini.',
          })
        } else {
          setState({ kind: 'manual', message: result.error ?? 'Gagal membuat QR.' })
        }
      })
      .catch(() => {
        if (!cancelled && mountedRef.current) {
          setState({ kind: 'manual', message: 'Gagal membuat QR. Coba alur manual di bawah.' })
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceNumber])

  // Render QR jadi gambar setiap kali konten berubah.
  useEffect(() => {
    if (state.kind !== 'ready') return
    let cancelled = false
    QRCode.toDataURL(state.qrContent, { width: 280, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setErrorMessage('Gagal merender kode QR.')
      })
    return () => {
      cancelled = true
    }
  }, [state])

  // Hitung mundur + polling status.
  useEffect(() => {
    if (state.kind !== 'ready') return
    const expiresAtMs = new Date(state.expiresAt).getTime()

    const tick = () => {
      const left = expiresAtMs - Date.now()
      setRemainingMs(left)
      if (left <= 0) {
        setState({ kind: 'expired' })
      }
    }
    tick()
    const countdownId = setInterval(tick, 1000)

    const pollId = setInterval(async () => {
      try {
        const params = new URLSearchParams({ invoice: invoiceNumber })
        if (token) params.set('t', token)
        const res = await fetch(`/api/qris/status?${params.toString()}`)
        const json = (await res.json()) as { status?: string }
        if (json.status === 'PAID') {
          router.refresh()
        } else if (json.status === 'EXPIRED') {
          setState({ kind: 'expired' })
        }
      } catch {}
    }, 5000)

    return () => {
      clearInterval(countdownId)
      clearInterval(pollId)
    }
  }, [state, invoiceNumber, token, router])

  const regenerate = useCallback(async () => {
    setRegenerating(true)
    setErrorMessage('')
    try {
      const result = await generateDynamicQrAction(invoiceNumber, token)
      if (result.ok && result.qrContent && result.expiresAt) {
        setState({
          kind: 'ready',
          qrContent: result.qrContent,
          expiresAt: result.expiresAt,
        })
      } else {
        setErrorMessage(result.error ?? 'Gagal membuat QR baru.')
      }
    } catch {
      setErrorMessage('Gagal membuat QR baru.')
    } finally {
      setRegenerating(false)
    }
  }, [invoiceNumber, token])

  if (state.kind === 'loading') {
    return (
      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
        <p className="text-sm text-neutral-600">Menyiapkan kode QR pembayaran...</p>
      </section>
    )
  }

  if (state.kind === 'manual') {
    // Alur manual lama (upload bukti) sudah tampil di bawah — panel
    // ini tidak perlu menampilkan apa pun.
    return null
  }

  if (state.kind === 'expired') {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm md:p-6">
        <h2 className="text-lg font-bold text-amber-900">Kode QR kedaluwarsa</h2>
        <p className="mt-2 text-sm leading-6 text-amber-800">
          Masa berlaku QR sebelumnya sudah habis (20 menit). Buat QR baru
          untuk melanjutkan pembayaran — nominalnya tetap sama.
        </p>
        {errorMessage ? (
          <p className="mt-3 text-sm font-medium text-red-700">{errorMessage}</p>
        ) : null}
        <button
          type="button"
          onClick={regenerate}
          disabled={regenerating}
          className="mt-4 rounded-2xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {regenerating ? 'Membuat QR baru...' : 'Buat QR baru'}
        </button>
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm md:p-6">
      <h2 className="text-lg font-bold text-emerald-900">Bayar dengan QRIS</h2>
      <p className="mt-2 text-sm leading-6 text-emerald-800">
        Pindai kode QR ini dengan GoPay, DANA, ShopeePay, atau mobile
        banking apa pun. Nominal sudah terkunci{' '}
        <strong>Rp {amount.toLocaleString('id-ID')}</strong> — tidak perlu
        upload bukti, pembayaran terverifikasi otomatis.
      </p>

      <div className="mt-5 flex flex-col items-center">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="Kode QR pembayaran"
            width={280}
            height={280}
            className="rounded-2xl border border-white bg-white p-2 shadow-sm"
          />
        ) : (
          <p className="text-sm text-emerald-800">Memuat kode QR...</p>
        )}
        <p className="mt-3 text-sm font-semibold text-emerald-900">
          Berlaku {remainingMs !== null ? formatCountdown(remainingMs) : '—'} lagi
        </p>
        {errorMessage ? (
          <p className="mt-2 text-sm font-medium text-red-700">{errorMessage}</p>
        ) : null}
      </div>

      <p className="mt-4 text-center text-xs leading-5 text-emerald-700">
        Status halaman ini diperbarui otomatis setelah kamu membayar. Bila QR
        kedaluwarsa sebelum sempat dibayar, tombol buat QR baru akan muncul.
      </p>
    </section>
  )
}
