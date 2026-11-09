// Regresi 2026-11-09: file 'use server' HANYA boleh mengekspor async
// function (aturan Next.js). Satu objek yang diekspor —
// `ALLOWED_TRANSITIONS` dari src/lib/actions/order-fulfillment.ts —
// membuat modul action gagal dimuat saat dievaluasi
// ("A \"use server\" file can only export async functions, found object"),
// sehingga SEMUA aksi seller di halaman detail order mengembalikan
// HTTP 500 dan tidak pernah jalan, padahal halaman GET-nya normal dan
// `next build` + tsc + eslint + vitest semuanya lolos. Tes ini memindai
// sumber statis agar pelanggaran yang sama tidak lolos lagi.
//
// Yang diizinkan: `export async function` dan ekspor tipe
// (`interface`/`type`, terhapus saat kompilasi). Yang dilarang: ekspor
// nilai runtime (`export const/let/var/class/enum`).
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC_ROOT = path.resolve(__dirname, '..', 'src')

async function collectTsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await collectTsFiles(full)))
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full)
  }
  return files
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1')
}

function hasUseServerDirective(source: string): boolean {
  const withoutComments = stripComments(source).trimStart()
  return (
    withoutComments.startsWith("'use server'") ||
    withoutComments.startsWith('"use server"')
  )
}

describe('use server: hanya async function yang boleh diekspor', () => {
  it('tidak ada file use server yang mengekspor nilai runtime', async () => {
    const files = await collectTsFiles(SRC_ROOT)
    const violations: string[] = []
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      if (!hasUseServerDirective(source)) continue
      const clean = stripComments(source)
      const bad = clean.match(
        /^\s*export\s+(const|let|var|class|enum)\s+([A-Za-z_$][\w$]*)/m
      )
      if (bad) {
        violations.push(
          `${path.relative(SRC_ROOT, file)}: export ${bad[1]} ${bad[2]}`
        )
      }
    }
    expect(violations).toEqual([])
  })

  it('ALLOWED_TRANSITIONS tinggal di modul biasa, bukan di file use server', async () => {
    const transitions = await readFile(
      path.join(SRC_ROOT, 'lib', 'order-transitions.ts'),
      'utf8'
    )
    expect(hasUseServerDirective(transitions)).toBe(false)
    expect(transitions).toContain('export const ALLOWED_TRANSITIONS')

    const fulfillment = await readFile(
      path.join(SRC_ROOT, 'lib', 'actions', 'order-fulfillment.ts'),
      'utf8'
    )
    expect(hasUseServerDirective(fulfillment)).toBe(true)
    expect(fulfillment).not.toContain('export const ALLOWED_TRANSITIONS')
    expect(fulfillment).toContain(
      "from '@/lib/order-transitions'"
    )
  })
})
