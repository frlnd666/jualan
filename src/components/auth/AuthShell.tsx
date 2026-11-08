import type { ReactNode } from 'react'
import Image from 'next/image'

/**
 * Kerangka visual bersama untuk halaman auth (login, register,
 * lupa/reset password): latar kertas, kartu putih terpusat,
 * dan logo CUAN. Logika tiap halaman tetap di halamannya sendiri.
 */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10">
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/logo-cuan.svg"
            alt="Logo CUAN"
            width={56}
            height={56}
            className="h-14 w-14"
          />
          <p className="mt-3 text-xl font-bold tracking-tight text-[var(--text)]">CUAN</p>
          <p className="text-sm text-[var(--text-muted)]">Toko online untuk UMKM Indonesia</p>
        </div>

        <div className="rounded-3xl bg-white p-7 shadow-2xl md:p-8">
          <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-neutral-500">{subtitle}</p>

          {children}

          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>

        <p className="mt-5 text-center text-xs text-[var(--text-muted)]">
          Aman &amp; terenkripsi — data tokomu hanya milikmu.
        </p>
      </div>
    </div>
  )
}

/** Tombol Google dengan ikon "G" resmi. */
export function GoogleAuthButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 flex w-full items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="#4285F4"
          d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.58v2.97h3.88c2.27-2.09 3.57-5.18 3.57-8.74z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-2.97c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.07A11.98 11.98 0 0 0 12 24z"
        />
        <path
          fill="#FBBC05"
          d="M5.29 14.32A7.2 7.2 0 0 1 4.91 12c0-.81.14-1.59.38-2.32V6.61H1.28a12 12 0 0 0 0 10.78l4.01-3.07z"
        />
        <path
          fill="#EA4335"
          d="M12 4.73c1.76 0 3.35.61 4.6 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 11.98 11.98 0 0 0 1.28 6.61l4.01 3.07C6.23 6.84 8.88 4.73 12 4.73z"
        />
      </svg>
      <span>{label}</span>
    </button>
  )
}

/** Garis pemisah "atau" di antara tombol Google dan form email. */
export function AuthOrDivider() {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-neutral-200" />
      <span className="text-xs text-neutral-400">atau</span>
      <div className="h-px flex-1 bg-neutral-200" />
    </div>
  )
}

export const authInputClass =
  'w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#0b6b4a] focus:outline-none focus:ring-2 focus:ring-[#0b6b4a]/30'

export const authLabelClass = 'mb-1 block text-sm font-medium text-neutral-700'

export const authErrorClass =
  'rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700'

export const authSubmitClass =
  'w-full rounded-xl bg-[var(--text)] py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
