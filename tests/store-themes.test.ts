import { describe, expect, it } from 'vitest'
import {
  STORE_THEMES,
  resolveStoreTheme,
  storeThemeStyle,
} from '@/lib/store-themes'

describe('resolveStoreTheme', () => {
  it('memetakan nilai tersimpan ke tema yang benar', () => {
    expect(resolveStoreTheme('warm').key).toBe('warm')
    expect(resolveStoreTheme('minimal').key).toBe('minimal')
    expect(resolveStoreTheme('default').key).toBe('default')
  })

  it('nilai asing/kosong jatuh ke default (toko lama tetap tampil normal)', () => {
    expect(resolveStoreTheme(null).key).toBe('default')
    expect(resolveStoreTheme(undefined).key).toBe('default')
    expect(resolveStoreTheme('indigo').key).toBe('default')
    expect(resolveStoreTheme('').key).toBe('default')
  })

  it('default tidak meng-override variable apa pun (token platform)', () => {
    expect(STORE_THEMES.default.vars).toEqual({})
  })

  it('warm & minimal meng-override warna inti dengan nilai valid', () => {
    for (const key of ['warm', 'minimal'] as const) {
      const vars = STORE_THEMES[key].vars
      for (const name of ['--bg', '--surface', '--text', '--primary', '--line']) {
        expect(vars[name], `${key} ${name}`).toMatch(/^#[0-9a-f]{6}$/i)
      }
      expect(STORE_THEMES[key].heroBackground).toContain('linear-gradient')
    }
  })

  it('storeThemeStyle mengembalikan vars tema terpilih', () => {
    expect(storeThemeStyle('warm')).toEqual(STORE_THEMES.warm.vars)
    expect(storeThemeStyle(null)).toEqual({})
  })
})

// Kontras WCAG (audit 2026-11-10 U-1): pasangan teks kecil yang
// benar-benar dipakai storefront harus ≥ 4,5:1 di tema override.
// Tema warm sebelumnya 4,40 & 4,34:1 — regresi ini menguncinya.
function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const channel = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
}

function contrastRatio(fg: string, bg: string): number {
  const a = luminance(fg)
  const b = luminance(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

describe('kontras tema override (WCAG AA teks kecil ≥ 4,5:1)', () => {
  for (const key of ['warm', 'minimal'] as const) {
    const vars = STORE_THEMES[key].vars
    it(`${key}: primary di atas primary-soft`, () => {
      expect(
        contrastRatio(vars['--primary'], vars['--primary-soft'])
      ).toBeGreaterThanOrEqual(4.5)
    })
    it(`${key}: teks redup di atas surface-soft`, () => {
      expect(
        contrastRatio(vars['--text-muted'], vars['--surface-soft'])
      ).toBeGreaterThanOrEqual(4.5)
    })
    it(`${key}: teks putih di atas tombol primary`, () => {
      expect(
        contrastRatio('#ffffff', vars['--primary'])
      ).toBeGreaterThanOrEqual(4.5)
    })
  }
})
