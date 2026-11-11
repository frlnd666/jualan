import { describe, expect, it } from 'vitest'
import { buildShareUrl, productShareText, storeShareText } from '@/lib/share'

describe('buildShareUrl', () => {
  it('menggabung origin + path relatif', () => {
    expect(buildShareUrl('https://cuan.is-a.web.id', '/kopisore/produk/kopi-kita')).toBe(
      'https://cuan.is-a.web.id/kopisore/produk/kopi-kita'
    )
  })

  it('menambah garis miring bila path tanpa awalan', () => {
    expect(buildShareUrl('https://cuan.is-a.web.id', 'kopisore')).toBe(
      'https://cuan.is-a.web.id/kopisore'
    )
  })

  it('membuang garis miring ganda di akhir origin', () => {
    expect(buildShareUrl('https://cuan.is-a.web.id/', '/kopisore')).toBe(
      'https://cuan.is-a.web.id/kopisore'
    )
  })

  it('membiarkan URL absolut apa adanya', () => {
    expect(buildShareUrl('https://cuan.is-a.web.id', 'https://kopisore.cuan.is-a.web.id/')).toBe(
      'https://kopisore.cuan.is-a.web.id/'
    )
  })

  it('path kosong = origin saja', () => {
    expect(buildShareUrl('https://cuan.is-a.web.id', '')).toBe('https://cuan.is-a.web.id')
  })
})

describe('productShareText', () => {
  it('nama + harga format Rupiah', () => {
    expect(productShareText('Kopi kita', 15000)).toBe('Kopi kita — Rp 15.000')
  })
})

describe('storeShareText', () => {
  it('nama + deskripsi bila ada', () => {
    expect(storeShareText('Kopi Sore', 'Ngopi santai tiap sore.')).toBe(
      'Kopi Sore — Ngopi santai tiap sore.'
    )
  })

  it('nama saja bila deskripsi kosong', () => {
    expect(storeShareText('Kopi Sore', null)).toBe('Kopi Sore')
  })
})
