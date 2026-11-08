"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const links = [
  { href: "#demo", label: "Contoh toko" },
  { href: "#fitur", label: "Fitur" },
  { href: "#cara-kerja", label: "Cara kerja" },
  { href: "#harga", label: "Harga" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[color:rgba(246,243,238,0.85)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="#top" className="flex items-center gap-2.5">
          <Image
            src="/logo-cuan.svg"
            alt="Logo CUAN"
            width={36}
            height={36}
            className="h-9 w-9"
          />
          <span className="text-lg font-bold tracking-tight text-[var(--text)]">
            CUAN
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-[var(--text-muted)] md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-[var(--text)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="btn btn-secondary px-4 py-2.5 text-sm"
          >
            Masuk
          </Link>
          <Link
            href="/register"
            className="btn btn-primary px-5 py-2.5 text-sm"
          >
            Buat toko gratis
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Tutup menu" : "Buka menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            className="border-t border-[var(--line)] bg-[var(--surface)] md:hidden"
          >
            <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)]"
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-3 flex gap-2 px-3 pb-1">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="btn btn-secondary flex-1 px-4 py-2.5 text-center text-sm"
                >
                  Masuk
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="btn btn-primary flex-1 px-4 py-2.5 text-center text-sm"
                >
                  Buat toko gratis
                </Link>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
