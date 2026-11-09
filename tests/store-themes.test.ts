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
