import { describe, expect, it } from 'vitest'
import { extractProductImagePath } from '@/lib/product-image'

describe('extractProductImagePath', () => {
  it('mengekstrak path objek dari URL publik Supabase', () => {
    expect(
      extractProductImagePath(
        'https://abc.supabase.co/storage/v1/object/public/product-images/products/kopi-1.jpg'
      )
    ).toBe('products/kopi-1.jpg')
  })

  it('mengembalikan null untuk URL asing / kosong', () => {
    expect(extractProductImagePath('https://res.cloudinary.com/x/image.jpg')).toBeNull()
    expect(extractProductImagePath('')).toBeNull()
    expect(extractProductImagePath(null)).toBeNull()
    expect(extractProductImagePath(undefined)).toBeNull()
  })

  it('membuang query string', () => {
    expect(
      extractProductImagePath(
        'https://abc.supabase.co/storage/v1/object/public/product-images/a.jpg?v=2'
      )
    ).toBe('a.jpg')
  })
})
