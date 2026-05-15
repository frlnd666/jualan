"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

const links = [
  { href: "#features", label: "Features" },
  { href: "#demo", label: "Demo" },
  { href: "#pricing", label: "Pricing" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[color:rgba(246,243,238,0.82)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="#top" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--text)] text-sm font-semibold text-[var(--surface)] shadow-[var(--shadow-sm)]">
            U
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[0.14em] text-[var(--text)]">
              UMKM Storefront
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Toko online tanpa coding
            </p>
          </div>
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
          <Link href="/login" className="transition hover:text-[var(--text)]">
            Login
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-[var(--primary)] px-5 py-2.5 font-medium text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--primary-hover)]"
          >
            Mulai Gratis
          </Link>
        </nav>

        <button
          type="button"
          aria-label="Buka menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] md:hidden"
        >
          <div className="space-y-1.5">
            <span className="block h-0.5 w-5 rounded-full bg-[var(--text)]" />
            <span className="block h-0.5 w-5 rounded-full bg-[var(--text)]" />
          </div>
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.18 }}
            className="border-t border-[var(--line)] bg-[var(--surface)] md:hidden"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-2xl px-3 py-3 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)]"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-2xl px-3 py-3 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)]"
              >
                Login
              </Link>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-full bg-[var(--primary)] px-5 py-3 text-center text-sm font-medium text-white"
              >
                Mulai Gratis
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}