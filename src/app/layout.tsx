export const metadata: Metadata = {
title: 'UMKM Storefront',
description: 'Platform toko online untuk UMKM Indonesia',
manifest: '/manifest.json',
}
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'UMKM Storefront',
  description: 'Platform toko online untuk UMKM Indonesia',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}