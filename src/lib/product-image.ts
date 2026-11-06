/**
 * Helper foto produk di bucket Supabase Storage `product-images`.
 * URL tersimpan berbentuk URL publik: .../object/public/product-images/<path>
 */

export function extractProductImagePath(publicUrl: string | null | undefined): string | null {
  if (!publicUrl) return null
  const marker = '/product-images/'
  const index = publicUrl.indexOf(marker)
  if (index === -1) return null
  const path = decodeURIComponent(publicUrl.slice(index + marker.length).split('?')[0])
  return path || null
}

interface StorageRemover {
  storage: {
    from: (bucket: string) => {
      remove: (paths: string[]) => PromiseLike<{ error: unknown }>
    }
  }
}

/** Hapus objek foto dari storage (best-effort; kegagalan tidak melempar). */
export async function removeProductImageObject(
  supabase: StorageRemover,
  publicUrl: string | null | undefined
): Promise<void> {
  const path = extractProductImagePath(publicUrl)
  if (!path) return
  try {
    await supabase.storage.from('product-images').remove([path])
  } catch {
    // Foto yatim di storage lebih baik daripada alur simpan yang gagal.
  }
}
