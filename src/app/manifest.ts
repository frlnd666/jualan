import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CUAN',
    short_name: 'CUAN',
    description: 'Platform toko online untuk UMKM Indonesia',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f6f3ee',
    theme_color: '#0b6b4a',
    icons: [
      {
        src: '/icons/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
