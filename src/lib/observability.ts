// Observability (Fase 4, rencana SaaS Bab 7).
// Logging terstruktur untuk aksi server penting — cukup di server console
// (stdout Vercel), TIDAK dikirim ke layanan luar. Satu baris JSON per
// event supaya gampang dicari di log Vercel (filter berdasarkan `event`).
// Tidak ada data sensitif di sini: tanpa token, tanpa secret, tanpa
// nomor rekening — hanya id + nominal + hasil.

export type LogEventName =
  | 'order_created'
  | 'payment_confirmed'
  | 'qris_webhook_received'
  | 'qris_webhook_paid'
  | 'qris_webhook_rejected'

export interface LogEventRecord {
  ts: string
  event: LogEventName
  [key: string]: unknown
}

/**
 * Tulis satu event terstruktur ke console. Mengembalikan record-nya
 * (supaya bisa dites) — pemanggil tidak perlu memakai nilai kembali.
 */
export function logEvent(
  event: LogEventName,
  fields: Record<string, unknown> = {}
): LogEventRecord {
  const record: LogEventRecord = {
    ts: new Date().toISOString(),
    event,
    ...fields,
  }
  try {
    console.log(JSON.stringify(record))
  } catch {
    // Logging tidak boleh menggagalkan aksi utama.
  }
  return record
}

/** Cek env wajib — hanya boolean, nilainya TIDAK PERNAH dikembalikan. */
export type RequiredEnvStatus = {
  supabaseUrl: boolean
  supabaseServiceRole: boolean
  shopeepayEncryptionKey: boolean
  platformBank: boolean
}

export function requiredEnvStatus(): RequiredEnvStatus {
  return {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    shopeepayEncryptionKey: Boolean(process.env.SHOPEEPAY_ENCRYPTION_KEY),
    platformBank: Boolean(process.env.NEXT_PUBLIC_PLATFORM_BANK_ACCOUNT),
  }
}
