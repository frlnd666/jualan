// WhatsApp via Meta Cloud API (resmi) — transport notifikasi CUAN.
//
// KEBIJAKAN BIAYA (jujur, jangan diubah tanpa riset ulang):
// - Akses API-nya gratis, tapi tiap pesan TEMPLATE UTILITY yang dikirim
//   proaktif (di luar jendela balasan pelanggan) DITAGIH Meta per pesan.
//   Rate card 1 Okt 2026 untuk Indonesia: Rp356,65/pesan utility.
// - Yang gratis hanya 1.000 SERVICE REPLY per bulan per nomor — yaitu
//   balasan atas chat yang DIMULAI pelanggan (bukan notifikasi proaktif).
//   Channel ini TIDAK memakai service reply; semua kiriman di sini adalah
//   template utility berbayar.
// - Karena itu channel ini ENV-GATED dan NONAKTIF bila env belum diisi:
//   tanpa WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID, pengiriman
//   dilewati diam-diam (status 'skipped', bukan error) dan in-app +
//   email tetap jalan.
// - JANGAN pakai Fonnte/Wablas/dll sebagai default: berbayar bulanan +
//   tidak resmi (risiko nomor diblokir Meta).
//
// Template: NAMA template dibaca dari env per jenis event (lihat
// whatsappTemplateName di notify.ts) supaya Ferlan bisa memakai nama
// template yang sudah disetujui di Meta. Parameter body {{1}}..{{n}}
// harus cocok URUTANNYA dengan template yang dibuat di Meta — lihat
// supabase/README.md bagian "Notifikasi email + WhatsApp".

export interface WhatsAppTemplateParameter {
  type: 'text'
  text: string
}

export interface WhatsAppPayload {
  messaging_product: 'whatsapp'
  recipient_type: 'individual'
  to: string
  type: 'template'
  template: {
    name: string
    language: { code: string }
    components: Array<{
      type: 'body'
      parameters: WhatsAppTemplateParameter[]
    }>
  }
}

export type WhatsAppSendResult =
  | { ok: true; skipped: false; messageId: string | null }
  | { ok: false; skipped: false; error: string }
  | { ok: false; skipped: true; reason: string }

/** Env WhatsApp sudah lengkap? Hanya boolean — nilai TIDAK PERNAH dikembalikan. */
export function isWhatsAppConfigured(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID)
}

/**
 * Normalisasi nomor ke format internasional tanpa '+' (yang diminta
 * Graph API), mis. 0812... / +62812... / 62812... → 62812...
 * Mengembalikan '' bila tidak ada digit yang valid. Berbeda dengan
 * normalizePhoneNumber di lib/utils/order: angka yang diawali '8'
 * (tanpa 0, mis. dari form yang memotong 0) juga dilengkapi '62'.
 */
export function normalizeWhatsAppNumber(phone: string | null | undefined): string {
  if (!phone) return ''
  const cleaned = phone.replace(/\D/g, '')
  if (!cleaned) return ''
  if (cleaned.startsWith('0')) return `62${cleaned.slice(1)}`
  if (cleaned.startsWith('62')) return cleaned
  if (cleaned.startsWith('8')) return `62${cleaned}`
  return cleaned
}

/** Payload POST /{phone_number_id}/messages — murni, gampang dites. */
export function buildWhatsAppPayload(
  to: string,
  templateName: string,
  parameters: string[]
): WhatsAppPayload {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizeWhatsAppNumber(to),
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'id' },
      components: [
        {
          type: 'body',
          parameters: parameters.map((text) => ({ type: 'text', text })),
        },
      ],
    },
  }
}

export interface WhatsAppSenderDeps {
  fetchImpl?: typeof fetch
  env?: NodeJS.ProcessEnv
}

/**
 * Kirim satu pesan template. TIDAK PERNAH melempar — semua kegagalan
 * dikembalikan sebagai hasil supaya dispatcher bisa mencatatnya tanpa
 * mengganggu alur utama. Bila env belum diisi → skipped (bukan error).
 */
export async function sendWhatsAppMessage(
  input: { to: string; templateName: string; parameters: string[] },
  deps: WhatsAppSenderDeps = {}
): Promise<WhatsAppSendResult> {
  const env = deps.env ?? process.env
  const accessToken = env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID
  if (!accessToken || !phoneNumberId) {
    return {
      ok: false,
      skipped: true,
      reason: 'WhatsApp belum dikonfigurasi (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID kosong).',
    }
  }

  const to = normalizeWhatsAppNumber(input.to)
  if (!to) {
    return { ok: false, skipped: true, reason: 'Nomor WhatsApp penerima kosong.' }
  }

  const fetchImpl = deps.fetchImpl ?? fetch
  try {
    const res = await fetchImpl(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildWhatsAppPayload(to, input.templateName, input.parameters)),
      }
    )
    if (!res.ok) {
      let detail = `HTTP ${res.status}`
      try {
        const body = (await res.json()) as {
          error?: { message?: string; code?: number }
        }
        if (body?.error?.message) detail = body.error.message
      } catch {}
      return { ok: false, skipped: false, error: `Meta Cloud API: ${detail}` }
    }
    let messageId: string | null = null
    try {
      const body = (await res.json()) as {
        messages?: Array<{ id?: string }>
      }
      messageId = body?.messages?.[0]?.id ?? null
    } catch {}
    return { ok: true, skipped: false, messageId }
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      error: err instanceof Error ? err.message : 'Gagal menghubungi Meta Cloud API.',
    }
  }
}
