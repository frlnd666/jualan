import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  dispatchNotify,
  notifyOrderEvent,
  buildEmailContent,
  buildWhatsAppTemplateParams,
  whatsappTemplateName,
  getNotificationPreferences,
  formatRupiah,
  escapeHtml,
} from '@/lib/notify'
import {
  normalizeWhatsAppNumber,
  buildWhatsAppPayload,
  sendWhatsAppMessage,
  isWhatsAppConfigured,
} from '@/lib/whatsapp'
import { sendEmail, isEmailConfigured, type EmailSender } from '@/lib/email-resend'

// ---------------------------------------------------------------------------
// Stub client Supabase minimal: rantai select/eq/order/limit/maybeSingle
// + insert + auth.admin.getUserById. Mencatat insert notifikasi in-app.
// ---------------------------------------------------------------------------

interface FakeClientOptions {
  prefsRow?: Record<string, unknown> | null
  prefsError?: { message: string } | null
  emailByUser?: Record<string, string>
  phoneByTable?: Record<string, string | null>
  insertError?: { message: string } | null
}

class FakeQuery {
  constructor(
    private result: unknown,
    private onInsert: (row: unknown) => void
  ) {}
  select() {
    return this
  }
  eq() {
    return this
  }
  order() {
    return this
  }
  limit() {
    return this
  }
  async maybeSingle() {
    return this.result
  }
  async insert(row: unknown) {
    this.onInsert(row)
    return { error: (this.result as { error?: unknown })?.error ?? null }
  }
}

function fakeClient(opts: FakeClientOptions = {}) {
  const inserted: unknown[] = []
  const client = {
    inserted,
    from(table: string) {
      if (table === 'notification_preferences') {
        return new FakeQuery(
          { data: opts.prefsRow ?? null, error: opts.prefsError ?? null },
          () => {}
        )
      }
      if (table === 'notifications') {
        return new FakeQuery({ error: opts.insertError ?? null }, (row) =>
          inserted.push(row)
        )
      }
      // buyer_addresses / orders / stores — fallback nomor.
      const phone = opts.phoneByTable?.[table] ?? null
      const column =
        table === 'buyer_addresses'
          ? 'phone'
          : table === 'orders'
            ? 'customer_phone'
            : 'whatsapp'
      return new FakeQuery(
        { data: phone ? { [column]: phone } : null, error: null },
        () => {}
      )
    },
    auth: {
      admin: {
        async getUserById(userId: string) {
          const email = opts.emailByUser?.[userId]
          return { data: { user: email ? { email } : null } }
        },
      },
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client as any
}

// Perekam kiriman (ganti vi.fn supaya typing calls tidak rapuh).
function recordingEmailSender() {
  const sent: Array<{ from: string; to: string; subject: string; html: string }> = []
  const sender: EmailSender = {
    emails: {
      send: async (args) => {
        sent.push(args)
        return { data: { id: 'email-1' }, error: null }
      },
    },
  }
  return { sent, sender }
}

function recordingFetch() {
  const bodies: string[] = []
  const fetchImpl = (async (_url: unknown, init?: { body?: unknown }) => {
    bodies.push(typeof init?.body === 'string' ? init.body : '')
    return new Response(JSON.stringify({ messages: [{ id: 'wamid.1' }] }), {
      status: 200,
    })
  }) as unknown as typeof fetch
  return { bodies, fetchImpl }
}

const okFetch = async () =>
  new Response(JSON.stringify({ messages: [{ id: 'wamid.1' }] }), {
    status: 200,
  })

const EMAIL_ENV = { RESEND_API_KEY: 're_test_key' }
const WA_ENV = {
  WHATSAPP_ACCESS_TOKEN: 'wa_test_token',
  WHATSAPP_PHONE_NUMBER_ID: '123456',
}

function setEnv(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) process.env[k] = v
}
function unsetEnv(keys: string[]) {
  for (const k of keys) delete process.env[k]
}

const savedEnv: Record<string, string | undefined> = {}
beforeEach(() => {
  for (const k of Object.keys({ ...EMAIL_ENV, ...WA_ENV })) {
    savedEnv[k] = process.env[k]
  }
  unsetEnv(Object.keys({ ...EMAIL_ENV, ...WA_ENV }))
})
afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

const baseData = {
  storeName: 'Toko Ferlan',
  orderNumber: 'INV-20261109-ABC123',
  customerName: 'Budi',
  total: 150000,
}

// ---------------------------------------------------------------------------
// Nomor WhatsApp + payload
// ---------------------------------------------------------------------------

describe('normalizeWhatsAppNumber', () => {
  it('0812… → 62812…, +62… dan 62… tetap, 8… dilengkapi 62', () => {
    expect(normalizeWhatsAppNumber('081234567890')).toBe('6281234567890')
    expect(normalizeWhatsAppNumber('+6281234567890')).toBe('6281234567890')
    expect(normalizeWhatsAppNumber('6281234567890')).toBe('6281234567890')
    expect(normalizeWhatsAppNumber('81234567890')).toBe('6281234567890')
    expect(normalizeWhatsAppNumber('0812-3456-7890')).toBe('6281234567890')
  })
  it('kosong / tanpa digit → string kosong', () => {
    expect(normalizeWhatsAppNumber('')).toBe('')
    expect(normalizeWhatsAppNumber(null)).toBe('')
    expect(normalizeWhatsAppNumber(undefined)).toBe('')
    expect(normalizeWhatsAppNumber('---')).toBe('')
  })
})

describe('buildWhatsAppPayload', () => {
  it('payload template: to ternormalisasi, bahasa id, parameter body berurutan', () => {
    const payload = buildWhatsAppPayload('081234567890', 'cuan_order_paid', [
      'Toko Ferlan',
      'INV-1',
      'Rp150.000',
    ])
    expect(payload.messaging_product).toBe('whatsapp')
    expect(payload.to).toBe('6281234567890')
    expect(payload.type).toBe('template')
    expect(payload.template.name).toBe('cuan_order_paid')
    expect(payload.template.language.code).toBe('id')
    expect(payload.template.components[0].parameters).toEqual([
      { type: 'text', text: 'Toko Ferlan' },
      { type: 'text', text: 'INV-1' },
      { type: 'text', text: 'Rp150.000' },
    ])
  })
})

describe('whatsappTemplateName', () => {
  it('default jelas per jenis event', () => {
    expect(whatsappTemplateName('ORDER_CREATED')).toBe('cuan_order_created')
    expect(whatsappTemplateName('ORDER_PAID')).toBe('cuan_order_paid')
    expect(whatsappTemplateName('QRIS_PAID')).toBe('cuan_order_paid')
    expect(whatsappTemplateName('ORDER_SHIPPED')).toBe('cuan_order_shipped')
    expect(whatsappTemplateName('SUBSCRIPTION_VERIFIED')).toBe(
      'cuan_subscription_verified'
    )
    expect(whatsappTemplateName('STAFF_ADDED')).toBe('cuan_staff_added')
  })
  it('env meng-override default', () => {
    expect(
      whatsappTemplateName('ORDER_PAID', {
        WHATSAPP_TEMPLATE_ORDER_PAID: 'toko_bayar_lunas',
      } as unknown as NodeJS.ProcessEnv)
    ).toBe('toko_bayar_lunas')
  })
})

describe('buildWhatsAppTemplateParams', () => {
  it('order dibuat (seller): toko, invoice, customer, total', () => {
    expect(buildWhatsAppTemplateParams('ORDER_CREATED', baseData, 'seller')).toEqual([
      'Toko Ferlan',
      'INV-20261109-ABC123',
      'Budi',
      'Rp150.000',
    ])
  })
  it('order dibayar: buyer [toko, invoice, total], seller [customer, invoice, total]', () => {
    expect(buildWhatsAppTemplateParams('ORDER_PAID', baseData, 'buyer')).toEqual([
      'Toko Ferlan',
      'INV-20261109-ABC123',
      'Rp150.000',
    ])
    expect(buildWhatsAppTemplateParams('ORDER_PAID', baseData, 'seller')).toEqual([
      'Budi',
      'INV-20261109-ABC123',
      'Rp150.000',
    ])
  })
  it('dikirim menyertakan resi; pengingat menyertakan sisa hari', () => {
    expect(
      buildWhatsAppTemplateParams(
        'ORDER_SHIPPED',
        { ...baseData, trackingNumber: 'RESI123' },
        'buyer'
      )
    ).toEqual(['Toko Ferlan', 'INV-20261109-ABC123', 'RESI123'])
    expect(
      buildWhatsAppTemplateParams(
        'TRIAL_ENDING_SOON',
        { storeName: 'Toko Ferlan', daysLeft: 3 },
        'seller'
      )
    ).toEqual(['Toko Ferlan', '3'])
  })
})

// ---------------------------------------------------------------------------
// Template email
// ---------------------------------------------------------------------------

describe('buildEmailContent', () => {
  it('order dibuat (seller): subjek + isi memuat toko, invoice, customer, total', () => {
    const { subject, html } = buildEmailContent(
      'ORDER_CREATED',
      { ...baseData, link: '/dashboard/orders/order-1' },
      'seller'
    )
    expect(subject).toContain('Toko Ferlan')
    expect(subject).toContain('INV-20261109-ABC123')
    expect(html).toContain('Budi')
    expect(html).toContain('Rp150.000')
    expect(html).toContain('/dashboard/orders/')
  })
  it('dikirim (buyer): subjek + isi memuat resi dan link lacak', () => {
    const { subject, html } = buildEmailContent(
      'ORDER_SHIPPED',
      { ...baseData, trackingNumber: 'RESI123', courier: 'JNE', link: '/akun/pesanan/o1' },
      'buyer'
    )
    expect(subject).toContain('RESI123')
    expect(html).toContain('RESI123')
    expect(html).toContain('JNE')
    expect(html).toContain('/akun/pesanan/o1')
  })
  it('pengingat H-1 vs H-3 memakai kata yang berbeda', () => {
    const h1 = buildEmailContent(
      'SUBSCRIPTION_ENDING_SOON',
      { storeName: 'Toko Ferlan', tier: 'Silver', daysLeft: 1 },
      'seller'
    )
    const h3 = buildEmailContent(
      'SUBSCRIPTION_ENDING_SOON',
      { storeName: 'Toko Ferlan', tier: 'Silver', daysLeft: 3 },
      'seller'
    )
    expect(h1.subject).toContain('besok')
    expect(h3.subject).toContain('3 hari lagi')
  })
  it('data user di-escape (tidak ada HTML mentah dari nama customer)', () => {
    const { html } = buildEmailContent(
      'ORDER_CREATED',
      { ...baseData, customerName: '<script>alert(1)</script>' },
      'seller'
    )
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('formatRupiah / escapeHtml', () => {
  it('format rupiah id-ID', () => {
    expect(formatRupiah(150000)).toBe('Rp150.000')
    expect(formatRupiah(0)).toBe('Rp0')
  })
  it('escape karakter HTML', () => {
    expect(escapeHtml('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;')
  })
})

// ---------------------------------------------------------------------------
// Preferensi
// ---------------------------------------------------------------------------

describe('getNotificationPreferences', () => {
  it('baris ada → dipakai apa adanya', async () => {
    const prefs = await getNotificationPreferences(
      fakeClient({
        prefsRow: {
          email_enabled: false,
          whatsapp_enabled: true,
          whatsapp_number: '081234567890',
        },
      }),
      'user-1'
    )
    expect(prefs).toEqual({
      emailEnabled: false,
      whatsappEnabled: true,
      whatsappNumber: '081234567890',
    })
  })
  it('tidak ada baris → default semua aktif', async () => {
    const prefs = await getNotificationPreferences(fakeClient({}), 'user-1')
    expect(prefs).toEqual({
      emailEnabled: true,
      whatsappEnabled: true,
      whatsappNumber: null,
    })
  })
  it('tabel belum ada (error) → default, tidak melempar', async () => {
    const prefs = await getNotificationPreferences(
      fakeClient({ prefsError: { message: 'relation "notification_preferences" does not exist' } }),
      'user-1'
    )
    expect(prefs.emailEnabled).toBe(true)
    expect(prefs.whatsappEnabled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Transport skip bila env kosong
// ---------------------------------------------------------------------------

describe('transport skip bila env kosong', () => {
  it('email: tanpa RESEND_API_KEY → skipped, bukan error', async () => {
    expect(isEmailConfigured({} as unknown as NodeJS.ProcessEnv)).toBe(false)
    const { sent, sender } = recordingEmailSender()
    const res = await sendEmail(
      { to: 'a@b.id', subject: 'x', html: '<p>x</p>' },
      { sender, env: {} as unknown as NodeJS.ProcessEnv }
    )
    expect(res.skipped).toBe(true)
    expect(sent).toHaveLength(0)
  })
  it('WA: tanpa token / phone number id → skipped, bukan error', async () => {
    expect(isWhatsAppConfigured({} as unknown as NodeJS.ProcessEnv)).toBe(false)
    const res = await sendWhatsAppMessage(
      { to: '081234567890', templateName: 'cuan_test', parameters: ['tes'] },
      { fetchImpl: okFetch, env: {} as unknown as NodeJS.ProcessEnv }
    )
    expect(res.skipped).toBe(true)
  })
  it('WA: HTTP error Meta → failed dengan pesan, tidak melempar', async () => {
    const badFetch = (async () =>
      new Response(JSON.stringify({ error: { message: 'Template not found', code: 132001 } }), {
        status: 400,
      })) as unknown as typeof fetch
    const res = await sendWhatsAppMessage(
      { to: '081234567890', templateName: 'cuan_nope', parameters: [] },
      { fetchImpl: badFetch, env: WA_ENV as unknown as NodeJS.ProcessEnv }
    )
    expect(res.ok).toBe(false)
    expect(res.skipped).toBe(false)
    if (!res.ok && !res.skipped) expect(res.error).toContain('Template not found')
  })
})

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

describe('dispatchNotify', () => {
  const input = {
    userId: 'user-1',
    storeId: 'store-1',
    orderId: 'order-1',
    type: 'ORDER_PAID' as const,
    title: 'Pembayaran terkonfirmasi',
    body: 'Pesanan sedang disiapkan.',
    link: '/akun/pesanan/order-1',
    data: baseData,
    recipient: 'buyer' as const,
  }

  it('env lengkap + preferensi default → in-app ditulis, email + WA terkirim', async () => {
    setEnv({ ...EMAIL_ENV, ...WA_ENV })
    const client = fakeClient({
      emailByUser: { 'user-1': 'buyer@example.id' },
      phoneByTable: { buyer_addresses: '081234567890' },
    })
    const { sent, sender } = recordingEmailSender()
    const { bodies, fetchImpl } = recordingFetch()
    const res = await dispatchNotify(client, input, {
      emailSender: sender,
      whatsappFetch: fetchImpl,
    })
    expect(res.inApp).toBe(true)
    expect(client.inserted).toHaveLength(1)
    expect(res.email.status).toBe('sent')
    expect(res.whatsapp.status).toBe('sent')
    expect(sent).toHaveLength(1)
    expect(bodies).toHaveLength(1)
    // Email terkirim ke alamat akun, WA ke nomor fallback dari alamat.
    expect(sent[0]?.to).toBe('buyer@example.id')
    expect(bodies[0]).toContain('6281234567890')
  })

  it('env kosong → kedua channel skipped, in-app tetap jalan', async () => {
    const client = fakeClient({ emailByUser: { 'user-1': 'buyer@example.id' } })
    const { sent, sender } = recordingEmailSender()
    const { bodies, fetchImpl } = recordingFetch()
    const res = await dispatchNotify(client, input, {
      emailSender: sender,
      whatsappFetch: fetchImpl,
    })
    expect(res.inApp).toBe(true)
    expect(res.email.status).toBe('skipped')
    expect(res.whatsapp.status).toBe('skipped')
    expect(sent).toHaveLength(0)
    expect(bodies).toHaveLength(0)
  })

  it('preferensi dimatikan → channel dilewati meski env lengkap', async () => {
    setEnv({ ...EMAIL_ENV, ...WA_ENV })
    const client = fakeClient({
      prefsRow: { email_enabled: false, whatsapp_enabled: false, whatsapp_number: null },
      emailByUser: { 'user-1': 'buyer@example.id' },
    })
    const { sent, sender } = recordingEmailSender()
    const { bodies, fetchImpl } = recordingFetch()
    const res = await dispatchNotify(client, input, {
      emailSender: sender,
      whatsappFetch: fetchImpl,
    })
    expect(res.email.status).toBe('skipped')
    expect(res.whatsapp.status).toBe('skipped')
    expect(sent).toHaveLength(0)
    expect(bodies).toHaveLength(0)
  })

  it('nomor WA kosong di semua fallback → WA skipped, email tetap terkirim', async () => {
    setEnv({ ...EMAIL_ENV, ...WA_ENV })
    const client = fakeClient({ emailByUser: { 'user-1': 'buyer@example.id' } })
    const { sent, sender } = recordingEmailSender()
    const res = await dispatchNotify(client, input, {
      emailSender: sender,
      whatsappFetch: okFetch,
    })
    expect(res.email.status).toBe('sent')
    expect(res.whatsapp.status).toBe('skipped')
    expect(res.whatsapp.detail).toContain('Nomor WhatsApp')
    expect(sent).toHaveLength(1)
  })

  it('nomor WA dari preferensi mengalahkan fallback alamat/order', async () => {
    setEnv({ ...EMAIL_ENV, ...WA_ENV })
    const client = fakeClient({
      prefsRow: {
        email_enabled: true,
        whatsapp_enabled: true,
        whatsapp_number: '089999999999',
      },
      emailByUser: { 'user-1': 'buyer@example.id' },
      phoneByTable: { buyer_addresses: '081234567890' },
    })
    const { bodies, fetchImpl } = recordingFetch()
    const { sender } = recordingEmailSender()
    const res = await dispatchNotify(client, input, {
      emailSender: sender,
      whatsappFetch: fetchImpl,
    })
    expect(res.whatsapp.status).toBe('sent')
    expect(bodies[0]).toContain('6289999999999')
  })

  it('transport gagal / melempar → failed, dispatcher TIDAK melempar', async () => {
    setEnv({ ...EMAIL_ENV, ...WA_ENV })
    const client = fakeClient({
      emailByUser: { 'user-1': 'buyer@example.id' },
      phoneByTable: { buyer_addresses: '081234567890' },
    })
    const throwingSender: EmailSender = {
      emails: {
        send: async () => {
          throw new Error('Resend down')
        },
      },
    }
    const throwingFetch = (async () => {
      throw new Error('Meta down')
    }) as unknown as typeof fetch
    // dispatchNotify tidak pernah melempar — await langsung sudah
    // membuktikan itu (tes gagal bila promise reject).
    const res = await dispatchNotify(client, input, {
      emailSender: throwingSender,
      whatsappFetch: throwingFetch,
    })
    expect(res.email.status).toBe('failed')
    expect(res.whatsapp.status).toBe('failed')
    expect(res.inApp).toBe(true)
  })

  it('tamu (tanpa userId): tanpa in-app, email dilewati, WA jalan via nomor order', async () => {
    setEnv({ ...EMAIL_ENV, ...WA_ENV })
    const client = fakeClient({})
    const { sent, sender } = recordingEmailSender()
    const { bodies, fetchImpl } = recordingFetch()
    const res = await dispatchNotify(
      client,
      {
        userId: null,
        phone: '081234567890',
        storeId: 'store-1',
        orderId: 'order-1',
        type: 'ORDER_PAID',
        title: 'Pembayaran terkonfirmasi',
        data: baseData,
        recipient: 'buyer',
      },
      { emailSender: sender, whatsappFetch: fetchImpl }
    )
    expect(res.inApp).toBe(false)
    expect(client.inserted).toHaveLength(0)
    expect(res.email.status).toBe('skipped')
    expect(res.whatsapp.status).toBe('sent')
    expect(sent).toHaveLength(0)
    expect(bodies).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Orkestrasi event order
// ---------------------------------------------------------------------------

describe('notifyOrderEvent', () => {
  const party = {
    ownerId: 'owner-1',
    buyerId: 'buyer-1',
    storeId: 'store-1',
    orderId: 'order-1',
    invoiceNumber: 'INV-20261109-ABC123',
    customerName: 'Budi',
    total: 150000,
  }

  it('ORDER_CREATED → in-app + email/WA ke seller DAN buyer (audit 2026-11-09: pembeli menerima instruksi bayar)', async () => {
    setEnv({ ...EMAIL_ENV, ...WA_ENV })
    const client = fakeClient({
      emailByUser: {
        'owner-1': 'seller@example.id',
        'buyer-1': 'buyer@example.id',
      },
      // Stub tidak membedakan user pada query fallback: hanya isi stores
      // supaya nomor seller ter-resolve lewat stores.whatsapp.
      phoneByTable: { stores: '081111111111' },
    })
    const { sent, sender } = recordingEmailSender()
    const { bodies, fetchImpl } = recordingFetch()
    await notifyOrderEvent(
      client,
      party,
      'ORDER_CREATED',
      'Toko Ferlan',
      {
        buyerPhone: '081234567890',
      },
      { emailSender: sender, whatsappFetch: fetchImpl }
    )
    // In-app: notifyOrderStatusChange menulis ke seller + buyer.
    expect(client.inserted).toHaveLength(2)
    // Email/WA: seller dan buyer (buyer = instruksi bayar + tautan).
    expect(sent).toHaveLength(2)
    expect(sent.map((s) => s.to)).toEqual(
      expect.arrayContaining(['seller@example.id', 'buyer@example.id'])
    )
    expect(bodies).toHaveLength(2)
    expect(bodies.join('\n')).toContain('6281111111111')
    expect(bodies.join('\n')).toContain('6281234567890')
  })

  it('ORDER_PAID → email/WA ke seller DAN buyer', async () => {
    setEnv({ ...EMAIL_ENV, ...WA_ENV })
    const client = fakeClient({
      emailByUser: {
        'owner-1': 'seller@example.id',
        'buyer-1': 'buyer@example.id',
      },
      phoneByTable: { stores: '081111111111', buyer_addresses: '081234567890' },
    })
    const { sent, sender } = recordingEmailSender()
    const { bodies, fetchImpl } = recordingFetch()
    await notifyOrderEvent(
      client,
      party,
      'ORDER_PAID',
      'Toko Ferlan',
      {
        buyerPhone: '081234567890',
      },
      { emailSender: sender, whatsappFetch: fetchImpl }
    )
    expect(sent).toHaveLength(2)
    const recipients = sent.map((s) => s.to)
    expect(recipients).toContain('seller@example.id')
    expect(recipients).toContain('buyer@example.id')
    expect(bodies).toHaveLength(2)
  })

  it('ORDER_SHIPPED → email/WA hanya ke buyer, sertakan resi', async () => {
    setEnv({ ...EMAIL_ENV, ...WA_ENV })
    const client = fakeClient({
      emailByUser: { 'buyer-1': 'buyer@example.id' },
      phoneByTable: { buyer_addresses: '081234567890' },
    })
    const { sent, sender } = recordingEmailSender()
    const { bodies, fetchImpl } = recordingFetch()
    await notifyOrderEvent(
      client,
      party,
      'ORDER_SHIPPED',
      'Toko Ferlan',
      {
        buyerPhone: '081234567890',
        trackingNumber: 'RESI123',
        courier: 'JNE',
      },
      { emailSender: sender, whatsappFetch: fetchImpl }
    )
    expect(sent).toHaveLength(1)
    expect(sent[0]?.subject).toContain('RESI123')
    expect(bodies[0]).toContain('RESI123')
  })
})
