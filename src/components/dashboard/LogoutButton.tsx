'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="inline-flex h-10 items-center rounded-full border border-[var(--line)] bg-white px-4 text-xs font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] transition active:scale-[0.98] disabled:opacity-50"
    >
      {loading ? 'Keluar...' : 'Keluar'}
    </button>
  )
}
