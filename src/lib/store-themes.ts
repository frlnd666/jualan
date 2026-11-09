// Tema tampilan toko (Pengaturan → Tema): default / warm / minimal.
//
// Audit 2026-11-09 menemukan pilihan tema ini MATI: kolom stores.theme
// dibaca storefront tapi tidak pernah diterapkan — semua toko tampil
// sama persis. Modul ini definisi tunggalnya: tiap tema adalah
// kumpulan override CSS variable yang dipasang sebagai inline style
// pada pembungkus halaman toko (storefront + halaman produk).
// Komponen di dalamnya sudah memakai var(--primary)/var(--bg)/dst
// (penyelarasan token PR #13), jadi override di pembungkus merambat
// ke semuanya — termasuk widget chat, tombol keranjang, dan navigasi
// bawah pembeli yang dirender di dalam halaman toko.
//
// Tema TIDAK berlaku di luar halaman toko: cart/checkout/invoice/
// dashboard tetap identitas platform CUAN.

import type { CSSProperties } from 'react'

export type StoreThemeKey = 'default' | 'warm' | 'minimal'

export interface StoreThemeDefinition {
  key: StoreThemeKey
  /** Label untuk Pengaturan & landing (era CUAN, bukan nama lama). */
  label: string
  /** Override variable desain; kosong = token platform apa adanya. */
  vars: Record<string, string>
  /** Latar hero storefront (di atas foto banner / sebagai pengganti). */
  heroBackground: string
}

const DEFAULT_HERO =
  'radial-gradient(circle at top left, rgba(255,255,255,0.16), transparent 32%), radial-gradient(circle at top right, rgba(255,210,160,0.18), transparent 24%), linear-gradient(135deg, #4b342b 0%, #2f241f 52%, #211814 100%)'

export const STORE_THEMES: Record<StoreThemeKey, StoreThemeDefinition> = {
  default: {
    key: 'default',
    label: 'Default (Zamrud)',
    vars: {},
    heroBackground: DEFAULT_HERO,
  },
  warm: {
    key: 'warm',
    label: 'Warm (Amber)',
    vars: {
      '--bg': '#faf5ea',
      '--surface': '#fffdf6',
      '--surface-soft': '#f4ead3',
      '--surface-muted': '#eee0c3',
      '--text': '#2b1d0e',
      '--text-muted': '#7d6a4f',
      '--line': '#eadfc6',
      '--primary': '#b45309',
      '--primary-hover': '#92400e',
      '--primary-soft': '#fdeeda',
      '--primary-deep': '#b45309',
      '--olive': '#8a7a4d',
      '--stone': '#d6c193',
    },
    heroBackground:
      'radial-gradient(circle at top left, rgba(255,255,255,0.18), transparent 32%), radial-gradient(circle at top right, rgba(255,190,90,0.22), transparent 24%), linear-gradient(135deg, #6b4210 0%, #472c07 52%, #2e1c04 100%)',
  },
  minimal: {
    key: 'minimal',
    label: 'Minimal (Slate)',
    vars: {
      '--bg': '#f8fafc',
      '--surface': '#ffffff',
      '--surface-soft': '#f1f5f9',
      '--surface-muted': '#e2e8f0',
      '--text': '#0f172a',
      '--text-muted': '#64748b',
      '--line': '#e2e8f0',
      '--primary': '#334155',
      '--primary-hover': '#1e293b',
      '--primary-soft': '#e2e8f0',
      '--primary-deep': '#334155',
      '--olive': '#64748b',
      '--stone': '#94a3b8',
    },
    heroBackground:
      'radial-gradient(circle at top left, rgba(255,255,255,0.14), transparent 32%), radial-gradient(circle at top right, rgba(148,163,184,0.20), transparent 24%), linear-gradient(135deg, #334155 0%, #1e293b 52%, #0f172a 100%)',
  },
}

export function resolveStoreTheme(
  value: string | null | undefined
): StoreThemeDefinition {
  if (value === 'warm' || value === 'minimal') return STORE_THEMES[value]
  return STORE_THEMES.default
}

/** Style inline untuk pembungkus halaman toko. */
export function storeThemeStyle(
  value: string | null | undefined
): CSSProperties {
  return resolveStoreTheme(value).vars as CSSProperties
}
