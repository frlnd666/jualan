import { describe, expect, it } from 'vitest'
import { normalizeStoreSlug, validateStoreSlug } from '@/lib/store-slug'

describe('normalizeStoreSlug', () => {
  it('mengubah spasi menjadi tanda hubung dan huruf kecil', () => {
    expect(normalizeStoreSlug('Kopi Susu Segar')).toBe('kopi-susu-segar')
  })

  it('TIDAK memakan huruf s (regresi bug regex lama)', () => {
    expect(normalizeStoreSlug('Susu Segar Sapi')).toBe('susu-segar-sapi')
    expect(normalizeStoreSlug('ss ss')).toBe('ss-ss')
  })

  it('membuang karakter non-alfanumerik dan merapikan hubung ganda', () => {
    expect(normalizeStoreSlug('  Toko@Baru!! 2026 ')).toBe('tokobaru-2026')
    expect(normalizeStoreSlug('kopi---sore')).toBe('kopi-sore')
    expect(normalizeStoreSlug('-kopi-')).toBe('kopi')
  })
})

describe('validateStoreSlug', () => {
  it('menerima slug yang wajar', () => {
    expect(validateStoreSlug('kopi-sore')).toBeNull()
    expect(validateStoreSlug('toko123')).toBeNull()
  })

  it('menolak slug terlalu pendek / panjang', () => {
    expect(validateStoreSlug('ab')).not.toBeNull()
    expect(validateStoreSlug('a'.repeat(41))).not.toBeNull()
  })

  it('menolak kata yang dipakai sistem', () => {
    expect(validateStoreSlug('login')).not.toBeNull()
    expect(validateStoreSlug('dashboard')).not.toBeNull()
    expect(validateStoreSlug('checkout')).not.toBeNull()
  })

  it('menolak format tidak valid', () => {
    expect(validateStoreSlug('Kopi')).not.toBeNull()
    expect(validateStoreSlug('-kopi')).not.toBeNull()
    expect(validateStoreSlug('kopi--sore')).not.toBeNull()
    expect(validateStoreSlug('')).not.toBeNull()
  })
})
