// Email via Resend — transport notifikasi CUAN.
//
// PAKET GRATIS RESEND (permanen, tanpa kartu kredit, tanpa overage):
// - 3.000 email/bulan, MAKS 100/hari. Bila cap tercapai, pengiriman
//   BERHENTI (API mengembalikan error) — tidak ada tagihan mendadak.
//   Dispatcher mencatat kegagalan itu ke log; in-app tetap jalan.
// - TANPA domain terverifikasi, Resend HANYA bisa mengirim ke alamat
//   email PEMILIK akun Resend itu. Jadi untuk tes awal: set RESEND_FROM
//   ke `CUAN <onboarding@resend.dev>` dan kirim ke email pemilik akun.
//   Untuk kirim ke SEMUA pembeli/penjual, verifikasi dulu domain
//   CUAN (cuan.is-a.web.id) di Resend lalu set RESEND_FROM ke
//   `CUAN <noreply@cuan.is-a.web.id>`. Lihat supabase/README.md.
// - Auth HANYA server-side (RESEND_API_KEY). Jangan beri prefix
//   NEXT_PUBLIC_ dan jangan commit nilainya.

import { Resend } from 'resend'

/** Alamat pengirim. Default memakai sender sandbox Resend — HANYA bisa
 * kirim ke email pemilik akun Resend; untuk kirim ke semua orang, isi
 * RESEND_FROM dengan `CUAN <noreply@cuan.is-a.web.id>` setelah domain
 * itu diverifikasi di Resend (lihat komentar atas file). */
export function resendFromAddress(env: NodeJS.ProcessEnv = process.env): string {
  return env.RESEND_FROM || 'CUAN <onboarding@resend.dev>'
}

/** Env email sudah lengkap? Hanya boolean — nilainya TIDAK PERNAH dikembalikan. */
export function isEmailConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.RESEND_API_KEY)
}

export interface EmailSendInput {
  to: string
  subject: string
  html: string
}

export type EmailSendResult =
  | { ok: true; skipped: false; id: string | null }
  | { ok: false; skipped: false; error: string }
  | { ok: false; skipped: true; reason: string }

/** Bentuk minimal client Resend yang dipakai — supaya tes bisa menyuntikkan stub. */
export interface EmailSender {
  emails: {
    send: (args: {
      from: string
      to: string
      subject: string
      html: string
    }) => Promise<{ data?: { id?: string } | null; error?: { message?: string } | null }>
  }
}

export interface EmailSenderDeps {
  sender?: EmailSender
  env?: NodeJS.ProcessEnv
}

/**
 * Kirim satu email. TIDAK PERNAH melempar — semua kegagalan dikembalikan
 * sebagai hasil supaya dispatcher bisa mencatatnya tanpa mengganggu alur
 * utama. Bila env belum diisi → skipped (bukan error).
 */
export async function sendEmail(
  input: EmailSendInput,
  deps: EmailSenderDeps = {}
): Promise<EmailSendResult> {
  const env = deps.env ?? process.env
  const apiKey = env.RESEND_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      skipped: true,
      reason: 'Email belum dikonfigurasi (RESEND_API_KEY kosong).',
    }
  }
  if (!input.to || !input.to.includes('@')) {
    return { ok: false, skipped: true, reason: 'Alamat email penerima kosong/tidak valid.' }
  }

  try {
    const sender: EmailSender = deps.sender ?? new Resend(apiKey)
    const { data, error } = await sender.emails.send({
      from: resendFromAddress(env),
      to: input.to,
      subject: input.subject,
      html: input.html,
    })
    if (error) {
      return { ok: false, skipped: false, error: `Resend: ${error.message}` }
    }
    return { ok: true, skipped: false, id: data?.id ?? null }
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      error: err instanceof Error ? err.message : 'Gagal menghubungi Resend.',
    }
  }
}
