import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CUAN — Toko Online UMKM",
  description:
    "CUAN adalah platform toko online untuk UMKM Indonesia — bikin toko online tanpa coding, pembayaran langsung ke rekeningmu.",
};

export const viewport: Viewport = {
  themeColor: "#0b6b4a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={inter.variable}>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}