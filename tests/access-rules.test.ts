import { describe, expect, it } from 'vitest'
import {
  canAccessSection,
  canAddStaff,
  canStaffAccess,
  nextOnboardingStep,
  isValidOnboardingStep,
  resolveCartOnLogin,
  staffSlotsLeft,
  validateBuyerAddress,
} from '@/lib/access-rules'

describe('canStaffAccess', () => {
  it('staff boleh beranda, produk, pesanan', () => {
    expect(canStaffAccess('beranda')).toBe(true)
    expect(canStaffAccess('produk')).toBe(true)
    expect(canStaffAccess('pesanan')).toBe(true)
  })

  it('staff tidak boleh pengaturan, langganan, pengiriman, chat, staff, admin', () => {
    for (const section of [
      'pengaturan',
      'langganan',
      'pengiriman',
      'chat',
      'staff',
      'admin',
    ] as const) {
      expect(canStaffAccess(section)).toBe(false)
    }
  })
})

describe('canAccessSection', () => {
  it('pemilik boleh semua bagian', () => {
    for (const section of [
      'beranda',
      'produk',
      'pesanan',
      'chat',
      'pengiriman',
      'langganan',
      'pengaturan',
      'staff',
    ] as const) {
      expect(canAccessSection('owner', section)).toBe(true)
    }
  })

  it('staff boleh beranda/produk/pesanan, tidak boleh yang lain', () => {
    expect(canAccessSection('staff', 'beranda')).toBe(true)
    expect(canAccessSection('staff', 'produk')).toBe(true)
    expect(canAccessSection('staff', 'pesanan')).toBe(true)
    expect(canAccessSection('staff', 'pengaturan')).toBe(false)
    expect(canAccessSection('staff', 'langganan')).toBe(false)
    expect(canAccessSection('staff', 'pengiriman')).toBe(false)
    expect(canAccessSection('staff', 'chat')).toBe(false)
    expect(canAccessSection('staff', 'staff')).toBe(false)
  })

  it('pembeli dan tanpa peran tidak boleh membuka dashboard toko', () => {
    expect(canAccessSection('buyer', 'produk')).toBe(false)
    expect(canAccessSection('none', 'beranda')).toBe(false)
    expect(canAccessSection('admin', 'produk')).toBe(false)
  })
})

describe('batas staff per tier', () => {
  it('Free (0 slot) tidak bisa tambah staff', () => {
    expect(canAddStaff(0, 0)).toBe(false)
    expect(staffSlotsLeft(0, 0)).toBe(0)
  })

  it('Silver (1 slot) bisa tambah 1, lalu penuh', () => {
    expect(canAddStaff(0, 1)).toBe(true)
    expect(canAddStaff(1, 1)).toBe(false)
    expect(staffSlotsLeft(1, 1)).toBe(0)
  })

  it('Gold (3 slot) menghitung sisa dengan benar', () => {
    expect(staffSlotsLeft(1, 3)).toBe(2)
    expect(canAddStaff(2, 3)).toBe(true)
    expect(canAddStaff(3, 3)).toBe(false)
  })

  it('jumlah negatif diperlakukan sebagai 0', () => {
    expect(staffSlotsLeft(-1, 1)).toBe(1)
  })
})

describe('langkah wizard onboarding', () => {
  it('langkah valid 0..5', () => {
    expect(isValidOnboardingStep(0)).toBe(true)
    expect(isValidOnboardingStep(5)).toBe(true)
    expect(isValidOnboardingStep(6)).toBe(false)
    expect(isValidOnboardingStep(-1)).toBe(false)
  })

  it('langkah berikutnya maju satu, langkah 5 kembali ke 0 (selesai)', () => {
    expect(nextOnboardingStep(1)).toBe(2)
    expect(nextOnboardingStep(4)).toBe(5)
    expect(nextOnboardingStep(5)).toBe(0)
    expect(nextOnboardingStep(0)).toBe(0)
  })

  it('langkah di luar rentang dianggap selesai (0)', () => {
    expect(nextOnboardingStep(99)).toBe(0)
    expect(nextOnboardingStep(-1)).toBe(0)
  })
})

describe('resolveCartOnLogin', () => {
  it('keranjang lokal kosong → pakai keranjang server', () => {
    const out = resolveCartOnLogin([], [{ productId: 'p1', qty: 2 }])
    expect(out.source).toBe('server')
    expect(out.items).toEqual([{ productId: 'p1', qty: 2 }])
  })

  it('keranjang lokal ada isinya → lokal menang', () => {
    const out = resolveCartOnLogin(
      [{ productId: 'p2', qty: 1 }],
      [{ productId: 'p1', qty: 2 }]
    )
    expect(out.source).toBe('local')
    expect(out.items).toEqual([{ productId: 'p2', qty: 1 }])
  })

  it('keduanya kosong → kosong', () => {
    expect(resolveCartOnLogin([], [])).toEqual({ items: [], source: 'empty' })
  })
})

describe('validateBuyerAddress', () => {
  it('alamat lengkap lolos', () => {
    expect(
      validateBuyerAddress({
        recipientName: 'Budi',
        phone: '0812',
        address: 'Jl. Mawar 1',
        province: 'Banten',
        city: 'Serang',
        postalCode: '42111',
      })
    ).toBeNull()
  })

  it('menolak bila ada kolom wajib kosong', () => {
    expect(
      validateBuyerAddress({
        recipientName: '',
        phone: '0812',
        address: 'Jl. Mawar 1',
        province: 'Banten',
        city: 'Serang',
        postalCode: '42111',
      })
    ).toContain('Nama penerima')
    expect(
      validateBuyerAddress({
        recipientName: 'Budi',
        phone: '0812',
        address: 'Jl. Mawar 1',
        province: 'Banten',
        city: 'Serang',
        postalCode: '',
      })
    ).toContain('Kode pos')
  })

  it('spasi saja dihitung kosong; label boleh kosong', () => {
    expect(
      validateBuyerAddress({
        recipientName: '   ',
        phone: '0812',
        address: 'Jl. Mawar 1',
        province: 'Banten',
        city: 'Serang',
        postalCode: '42111',
      })
    ).toContain('Nama penerima')
    expect(
      validateBuyerAddress({
        label: '',
        recipientName: 'Budi',
        phone: '0812',
        address: 'Jl. Mawar 1',
        province: 'Banten',
        city: 'Serang',
        postalCode: '42111',
      })
    ).toBeNull()
  })
})
