// Halaman kelola staff (Fase 2, owner-only): pemilik menambah staff
// lewat email akun pembeli yang sudah terdaftar. Batas staff mengikuti
// tier dan ditegakkan server-side di lib/actions/staff.ts.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOwnerStore } from '@/lib/dashboard-access'
import { listStaffAction } from '@/lib/actions/staff'
import StaffManager from '@/components/dashboard/StaffManager'

export default async function StaffPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const store = await getOwnerStore(supabase, user.id)
  if (!store) {
    return (
      <div className="mx-auto max-w-xl space-y-4 pt-6">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
          Staff Toko
        </h1>
        <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-sm)]">
          <p className="text-base font-bold text-[var(--text)]">
            Halaman ini hanya untuk pemilik toko
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Staff tidak bisa menambah atau menghapus staff lain. Masuk
            dengan akun pemilik toko untuk mengelola staff.
          </p>
        </section>
      </div>
    )
  }

  const result = await listStaffAction()
  const staff = 'staff' in result ? result.staff : []
  const slotsLeft = 'staff' in result ? result.slotsLeft : 0
  const tierName = 'staff' in result ? result.tierName : 'free'
  const error = 'error' in result ? result.error : null

  return (
    <div className="mx-auto max-w-xl space-y-5 pt-6">
      <div>
        <p className="text-sm font-medium text-[var(--text-muted)]">{store.name}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">
          Staff Toko
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          Staff bisa mengelola produk dan pesanan, tapi tidak bisa mengubah
          pengaturan toko, langganan, pembayaran, atau menambah staff lain.
          Calon staff harus sudah punya akun pembeli (daftar sebagai
          pembeli dulu).
        </p>
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </p>
      ) : null}

      <StaffManager
        initialStaff={staff}
        slotsLeft={slotsLeft}
        tierName={tierName}
      />
    </div>
  )
}
