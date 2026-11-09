// Form kelola staff (client): tambah lewat email + hapus staff.
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addStaffAction,
  removeStaffAction,
  type StaffMember,
} from '@/lib/actions/staff'

const TIER_LABEL: Record<string, string> = {
  free: 'Free',
  silver: 'Silver',
  gold: 'Gold',
}

export default function StaffManager({
  initialStaff,
  slotsLeft,
  tierName,
}: {
  initialStaff: StaffMember[]
  slotsLeft: number
  tierName: string
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isPending, startTransition] = useTransition()

  function add() {
    setError('')
    setNotice('')
    startTransition(async () => {
      try {
        const result = await addStaffAction(email)
        if ('error' in result) {
          setError(result.error)
          return
        }
        setNotice('Staff berhasil ditambahkan.')
        setEmail('')
        router.refresh()
      } catch {
        // P2-13: action melempar (mis. jaringan putus) — jangan biarkan
        // error naik ke error boundary; tampilkan inline.
        setError('Gagal menambah staff. Periksa koneksi lalu coba lagi.')
      }
    })
  }

  function remove(userId: string, label: string) {
    if (!window.confirm(`Hapus ${label} dari staff toko ini?`)) return
    startTransition(async () => {
      try {
        const result = await removeStaffAction(userId)
        if ('error' in result) {
          setError(result.error)
          return
        }
        setNotice('Staff dihapus — akunnya kembali menjadi pembeli.')
        router.refresh()
      } catch {
        // P2-13: action melempar (mis. jaringan putus) — jangan biarkan
        // error naik ke error boundary; tampilkan inline.
        setError('Gagal menghapus staff. Periksa koneksi lalu coba lagi.')
      }
    })
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
        <p className="text-sm text-[var(--text-muted)]">
          Paket {TIER_LABEL[tierName] ?? tierName} • slot staff tersisa:{' '}
          <strong className="text-[var(--text)]">{slotsLeft}</strong>
        </p>
        {slotsLeft <= 0 ? (
          <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Slot staff habis. Upgrade paket untuk menambah staff.
          </p>
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              add()
            }}
          >
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-neutral-700">
                Email akun pembeli
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="staff@email.com"
                className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none focus:border-neutral-900"
              />
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isPending ? 'Menambahkan...' : 'Tambah staff'}
            </button>
          </form>
        )}
        {error ? (
          <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
            {notice}
          </p>
        ) : null}
      </section>

      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
        <h2 className="text-base font-bold text-[var(--text)]">
          Staff saat ini ({initialStaff.length})
        </h2>
        {initialStaff.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Belum ada staff di toko ini.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {initialStaff.map((member) => (
              <li
                key={member.userId}
                className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-soft)] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text)]">
                    {member.email || member.userId}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Sejak{' '}
                    {new Date(member.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(member.userId, member.email || 'staff ini')}
                  disabled={isPending}
                  className="shrink-0 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                >
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
