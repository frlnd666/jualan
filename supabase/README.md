# Supabase — Aktivasi P0 Security

Folder ini berisi migrasi keamanan P0. Sebelumnya repo tidak menyimpan
skema/policy database sama sekali; mulai sekarang setiap perubahan skema
wajib masuk sebagai file di `migrations/`.

## Urutan aktivasi (jangan dibalik)

1. **Set env service role**
   - Supabase Dashboard → Project Settings → API → salin `service_role`.
   - Isi `SUPABASE_SERVICE_ROLE_KEY` di Vercel (Production) dan `.env.local`.
   - Key ini melewati semua RLS. Jangan beri prefix `NEXT_PUBLIC_`, jangan
     pernah commit nilai aslinya.
2. **Deploy kode** yang memakai env tersebut (branch `fix/p0-security`
   atau hasil merge-nya ke `main`), lalu pastikan aplikasi normal.
3. **Jalankan migrasi** `migrations/20261107_p0_security.sql` di
   Supabase SQL Editor. File ini:
   - menambah `invoices.access_token` (gerbang halaman invoice/track publik),
   - mengaktifkan RLS + policy kepemilikan untuk semua tabel,
   - membuat bucket `payment-proofs` privat.

Bila migrasi dijalankan sebelum langkah 1–2 selesai, halaman invoice/track
publik dan upload bukti transfer akan gagal membaca `invoices` (akses anon
sudah ditutup, sementara server belum punya service_role).

## Fase 0 — Fondasi SaaS (2026-11-08)

Urutan jalankan di Supabase SQL Editor, SETELAH migrasi P0/P0b/P1/P2 +
hotfix di atas selesai:

1. **`migrations/20261108_f0_core_schema.sql`** — rekonstruksi skema inti
   (stores, products, orders, dst.) + index + RLS enable. Idempotent;
   tidak mengubah data. Bagian yang tidak bisa dipastikan dari kode
   ditandai `NEEDS_LIVE_VERIFY` di komentar file.
2. **`migrations/20261108_f0_stock_rpc.sql`** — RPC `decrement_stock` /
   `increment_stock` (stok atomik). Kode checkout + pembatalan order
   sudah memakainya.
3. **`migrations/20261108_f0_roles.sql`** — tabel `profiles`
   (buyer/seller/staff/admin) + policy + bootstrap admin pertama
   (cara di komentar file; tanpa kredensial).

**Sebelum langkah 1**, jalankan **`verify_live_schema.sql`** (read-only,
hanya SELECT) dan bandingkan hasilnya dengan file migrasi. Bila live
berbeda dengan rekonstruksi, yang benar adalah live — perbaiki file
migrasi di repo, jangan paksa live mengikuti file. Bagian 7 skrip itu
merangkum pemeriksaan dengan label OK / PERLU TINDAKAN.

Catatan: checkout tetap memakai fallback mode legacy untuk invoice
tanpa `access_token` (lihat `src/lib/actions/checkout.ts`) sampai
migrasi P0 terkonfirmasi sudah dijalankan di live — fallback itu baru
boleh dihapus setelah `verify_live_schema.sql` bagian 7a menunjukkan OK.

## Fase 1 — Langganan (2026-11-08)

Urutan jalankan di Supabase SQL Editor, SETELAH seluruh migrasi Fase 0:

1. **`migrations/20261108_f1_subscriptions.sql`** — tabel
   `subscriptions` (1 baris per toko) + `subscription_payments` +
   backfill toko lama sebagai Free/ACTIVE + RLS. Idempotent; tidak
   mengubah data yang sudah ada.
2. **Tidak ada langkah SQL lain** — baris subscriptions toko baru dibuat
   kode aplikasi (server action `ensureStoreSubscription`) saat toko
   pertama dibuat; baris profiles dibuat otomatis di layout dashboard.

**Yang TIDAK dilakukan migrasi ini:** detail rekening/QRIS platform
untuk pembayaran langganan manual belum diisi — lihat
`src/lib/subscription-payment-config.ts` (TODO Ferlan). Tanpa detail
itu, penjual tidak tahu harus bayar ke mana, jadi alur upgrade belum
boleh dianggap selesai.

**Yang perlu diverifikasi Ferlan setelah migrasi:** register Free,
trial Silver 14 hari, upgrade manual + verifikasi admin, dan downgrade
(produk di atas 4 disembunyikan dari storefront, bukan dihapus).

## Fase 2 — Akun dan peran (2026-11-08)

Urutan jalankan di Supabase SQL Editor, SETELAH seluruh migrasi Fase 1:

1. **`migrations/20261108_f2_buyer_accounts.sql`** — akun pembeli +
   staff + onboarding. Idempotent (`IF NOT EXISTS` / `CREATE OR
   REPLACE` / `DROP POLICY IF EXISTS`); tidak mengubah data yang sudah
   ada. Isinya:
   - `orders.buyer_id` (nullable → `auth.users`) + policy select
     pembeli atas ordernya sendiri + policy select invoice lewat
     order miliknya;
   - tabel `buyer_addresses` (buku alamat) dan `buyer_carts` +
     `buyer_cart_items` (keranjang tersimpan per akun), RLS
     owner-only;
   - `stores.onboarding_step` (integer, default 0; 0 = belum mulai,
     5 = selesai);
   - helper `is_staff_of_store(uuid)` + policy staff (aditif) di
     products / orders / order_items / shipments / invoices — staff
     HANYA bisa produk + order tokonya, TIDAK bisa shipping_methods,
     subscriptions, subscription_payments, atau chat;
   - policy insert `stores` ditulis ulang supaya role staff tidak
     bisa membuat toko (pengecualian: user yang belum punya baris
     profiles, karena profiles dibuat malas);
   - trigger `prevent_role_escalation` diperluas: selain role, perubahan
     `store_id` oleh pemanggil ber-JWT yang bukan admin juga diblokir
     (menutup celah staff memindahkan dirinya ke toko lain);
   - RPC `decrement_stock` / `increment_stock` didefinisikan ulang
     supaya staff toko juga boleh mengembalikan stok saat membatalkan
     order (sebelumnya owner-only, jadi pembatalan staff gagal).
2. **Tidak ada langkah SQL lain** — baris `buyer_carts` dibuat kode
   aplikasi saat pembeli login pertama kali; `buyer_id` diisi checkout
   saat ada sesi login.

**Perilaku sebelum migrasi dijalankan:** checkout tetap jalan —
`createOrderAction` mencoba menyimpan `buyer_id`, dan bila kolom belum
ada, insert diulang tanpa kolom itu (pola yang sama dengan fallback
`access_token` Fase 0). Keranjang tersimpan, buku alamat, dan riwayat
pesanan pembeli baru aktif setelah migrasi dijalankan; sebelum itu
pembeli login tetap bisa checkout sebagai tamu.

**Yang perlu diverifikasi Ferlan setelah migrasi:** daftar sebagai
pembeli (`/register?type=buyer`) → keranjang tersimpan antar perangkat
→ checkout dengan alamat tersimpan → pesanan muncul di
`/akun/pesanan`; tambah staff dari `/dashboard/staff` (batas tier:
Free 0 / Silver 1 / Gold 3) → login staff hanya bisa produk +
pesanan; wizard `/dashboard/onboarding` 5 langkah; admin membekukan
toko dari `/dashboard/admin`.

**Yang TIDAK dibangun di Fase 2:** notifikasi (Fase 3), voucher
(Fase 3), watermark/iklan Free (Fase 4), cron transisi status
langganan (TRIALING→Free, ACTIVE→PAST_DUE→EXPIRED), dan auto-debit
(Fase 2 di rencana awal — ditunda, pembayaran langganan tetap
manual).

## Perilaku sebelum migrasi dijalankan

Kode dirancang tetap hidup di masa transisi:

- Checkout tetap mencoba menyimpan `access_token`; bila kolom belum ada,
  otomatis jatuh ke format lama (halaman publik berjalan di mode legacy,
  tetapi data pribadi tetap disamarkan).
- Lookup publik memakai client anon bila `SUPABASE_SERVICE_ROLE_KEY` belum
  diset, dan otomatis beralih ke service_role begitu env tersedia.

Mode transisi ini **bukan** keadaan aman final — keadaan aman tercapai
setelah ketiga langkah di atas selesai.

## Dampak yang disadari

- Link invoice lama (tanpa `?t=`) untuk invoice yang sudah punya token
  akan membuka halaman 404 setelah migrasi. Customer bisa dibantu dari
  dashboard: buka order terkait, nomor invoice + token bisa dibagikan ulang
  secara manual oleh seller.
- Setelah bucket `payment-proofs` privat, URL bukti transfer lama yang
  tersimpan berhenti bisa dibuka publik. Penayangan bukti di dashboard via
  signed URL adalah pekerjaan P1 berikutnya.

## Fase 3 — Transaksi (2026-11-08)

Urutan jalankan di Supabase SQL Editor, SETELAH seluruh migrasi Fase 0 + Fase 1 + Fase 2:

1. **`migrations/20261108_f3_transactions.sql`** — QRIS dinamis, voucher,
   notifikasi, catatan seller, ongkir berat. Idempotent (`IF NOT EXISTS` /
   `CREATE OR REPLACE` / `DROP POLICY IF EXISTS`); tidak mengubah data yang
   sudah ada. Isinya:
   - `store_shopeepay_credentials` (1 baris per toko; secret + private key
     TERENKRIPSI AES-256-GCM, RLS owner-only, staff tanpa akses);
   - `qris_payments` (jejak QR dinamis; partnerReferenceNo unik; satu QR
     PENDING per invoice via partial unique index);
   - `invoices.expires_at` (invoice QRIS kedaluwarsa bersama QR-nya;
     invoice manual NULL = tidak kedaluwarsa);
   - `vouchers` (kode unik per toko, persen/nominal, min order, kuota,
     masa berlaku) + `voucher_redemptions` (satu baris per order);
   - `notifications` (in-app per user; tulis hanya via service_role);
   - `orders.voucher_code / discount_amount / total_weight_gram /
     seller_note`;
   - `shipping_methods.courier_code / per_kg_price / base_weight_gram`.
2. **Isi env server** (Vercel Production + `.env.local`) — lihat
   `.env.local.example` bagian Fase 3:
   - `SHOPEEPAY_ENCRYPTION_KEY` (WAJIB sebelum menyimpan kredensial
     ShopeePay; 32 byte base64/hex; JANGAN diubah setelah kredensial
     tersimpan — kredensial lama jadi tidak terbaca).
   - `SHOPEEPAY_BASE_URL` (default sandbox; samakan dengan dokumen Partner).
   - `SHOPEEPAY_QR_STATUS_PATH` (path inquiry — BELUM TERKONFIRMASI dari
     dokumen Partner; samakan sebelum live).
3. **Kredensial sandbox ShopeePay Partner** untuk toko pilot (Client ID,
   Client Secret, Private Key PEM, Merchant ID) — diisi pemilik toko di
   Pengaturan → Pembayaran ShopeePay. Tanpa ini, QRIS dinamis tidak bisa
   diuji end-to-end; checkout QRIS tetap jalan lewat alur manual lama.

**Perilaku sebelum migrasi dijalankan:** checkout tetap jalan — select
metode pengiriman + insert order memakai fallback kolom lama (tanpa
komponen per-kg, tanpa pencatatan voucher). Voucher, notifikasi, dan QRIS
dinamis baru aktif setelah migrasi dijalankan; sebelum itu halaman terkait
menampilkan pesan yang sesuai (bukan crash).

**Yang perlu diverifikasi Ferlan setelah migrasi:** (1) buat voucher di
`/dashboard/vouchers` (Free ditolak) → checkout pakai kode → diskon
terpotong + kuota berkurang; (2) isi berat produk + tarif per-kg di
Pengiriman → checkout menampilkan ongkir sesuai berat; (3) ubah status
order / input resi → lonceng notifikasi bertambah (seller + pembeli
login); (4) bulk update + export CSV di `/dashboard/orders`; (5) QRIS
dinamis — HANYA setelah kredensial sandbox ada: isi kredensial →
checkout QRIS → QR tampil + hitung mundur → bayar sandbox → webhook
menandai PAID otomatis (cek checklist sandbox butir 1–7 di dokumen
rencana QRIS).

**Yang TIDAK dibangun di Fase 3:** cron transisi status langganan,
auto-debit, notifikasi email/WhatsApp (TODO — tidak ada jalur mail di
codebase; WhatsApp butuh keputusan provider), watermark/iklan Free
(Fase 4), dan inquiry status QR bila path-nya belum dikonfirmasi
(dokumen Partner).

## Fase 4 — Pertumbuhan (2026-11-09)

Urutan jalankan di Supabase SQL Editor, SETELAH seluruh migrasi Fase 0–3:

1. **`migrations/20261108_f4_growth.sql`** — flash sale, banner toko,
   audit log. Idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE` /
   `DROP POLICY IF EXISTS`); tidak mengubah data yang sudah ada. Isinya:
   - `flash_sales` (harga promo + jadwal mulai/selesai; satu flash sale
     AKTIF per produk via partial unique index; RLS owner-only, baca
     publik hanya yang aktif + di dalam jadwal);
   - `store_banners` (banner marketing; satu banner AKTIF per toko;
     RLS owner-only, baca publik hanya yang aktif);
   - `audit_log` (jejak aksi penting; tulis hanya service_role, baca
     hanya admin platform via `is_admin()`).
2. **Tidak ada langkah SQL lain.**

Analitik + export tidak butuh tabel baru (pakai orders / order_items /
invoices). Health check `GET /api/health` tidak butuh konfigurasi.

**Perilaku sebelum migrasi dijalankan:** flash sale, banner, dan audit
log tidak aktif (kode memakai fallback: harga normal di storefront +
checkout, tanpa banner, log dilewati). Analitik tetap jalan. Export CSV
analitik tetap ditegakkan server-side (hanya Gold).

**Yang perlu diverifikasi Ferlan setelah migrasi:** (1) `/dashboard/analytics`
→ GMV + produk terlaris + export CSV (Free/Silver ditolak); (2) buat
flash sale di `/dashboard/flash-sales` (Free ditolak) → harga promo
tampil di storefront + halaman produk → checkout memakai harga promo;
(3) buat banner di `/dashboard/banners` → tampil di storefront
(Silver/Gold); toko Free menampilkan slide "Iklan"; (4) foto produk
toko Free ber-watermark CUAN, Silver/Gold polos; (5) `/dashboard/admin/audit`
→ aksi verifikasi langganan / bekukan toko / staff / konfirmasi bayar /
ubah harga tercatat; (6) `GET /api/health` → `{"status":"ok",...}`.

**Yang TIDAK dibangun di Fase 4:** cron transisi status langganan,
auto-debit, notifikasi email/WhatsApp, custom domain (Fase 5).

## Fase 5 — Gold: custom domain + subdomain + SEO (2026-11-09)

Urutan jalankan di Supabase SQL Editor, SETELAH seluruh migrasi Fase 0–4:

1. **`migrations/20261108_f5_domains.sql`** — tabel `store_domains`
   (domain, status pending/verified/failed, vercel_added, verified_at).
   Idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE` /
   `DROP POLICY IF EXISTS`); tidak mengubah data yang sudah ada. RLS:
   owner-only untuk kelola, admin baca semua, publik hanya membaca
   yang `verified` (dipakai middleware untuk resolve hostname custom).
2. **Isi env server** (Vercel Production + `.env.local`) — lihat
   `.env.local.example` bagian Fase 5:
   - `VERCEL_API_TOKEN` (opsional tapi disarankan — tanpa ini, domain
     harus ditambahkan manual di Vercel Dashboard → Settings → Domains;
     JANGAN commit nilainya).
   - `VERCEL_PROJECT_ID` (sudah ada fallback `prj_N19xmVADtzl3Dvcnvoup2DW4L4s0`).
   - `NEXT_PUBLIC_PLATFORM_DOMAIN` (domain platform untuk subdomain
     `{slug}.domain` — sudah diset `cuan.is-a.web.id`; kosong = subdomain
     tidak aktif).
   - `NEXT_PUBLIC_SITE_URL` (default https://cuan.is-a.web.id).
3. **Subdomain platform** (sudah dipasang): `cuan.is-a.web.id` dan
   `*.cuan.is-a.web.id` sudah ditambahkan ke project Vercel `jualin`.
   DNS yang harus ada di pengelola DNS `is-a.web.id`:
   `cuan CNAME cname.vercel-dns.com` dan `*.cuan CNAME cname.vercel-dns.com`.
   Tanpa record ini, domain belum membuka aplikasi.

**Cara kerja routing:** middleware membaca header `host`. Host platform
(cuan.is-a.web.id, jualin-delta.vercel.app, `*.vercel.app`, localhost,
domain platform) jalan biasa. Subdomain `{slug}.cuan.is-a.web.id`
di-rewrite ke `/{slug}` (header `x-cuan-host-kind: subdomain`). Domain custom
terverifikasi di tabel `store_domains` di-rewrite ke `/{slug}` (header
`x-cuan-host-kind: custom`). Hanya path storefront (`/` dan
`/products/...`) yang di-rewrite — checkout, cart, invoice, auth, api,
dan sitemap lewat seperti biasa. Tautan di storefront memakai helper
`storePathForHost` supaya pengunjung tetap di host yang sama.

**Perilaku sebelum migrasi dijalankan:** halaman `/dashboard/domains`
menampilkan pesan "jalankan migrasi Fase 5 dulu" (bukan crash);
middleware memperlakukan semua host custom sebagai "tidak dikenal"
(halaman `/domain-tidak-dikenal`); SEO dasar tetap jalan; sitemap hanya
berisi halaman landing + toko/produk tanpa domain custom.

**Yang perlu diverifikasi Ferlan setelah migrasi:** (1) sebagai Gold,
buka `/dashboard/domains` → tambah domain sendiri → pasang DNS sesuai
instruksi → "Cek verifikasi" → status verified → buka domain itu →
storefront tokomu tampil (URL tetap domain sendiri); (2) Free/Silver
ditolak menambah domain; (3) subdomain `{slug}.domain-platform` tampil
bila domain platform + wildcard sudah dipasang (bila belum, halaman
menjelaskan yang dibutuhkan); (4) `/sitemap.xml` memuat toko + produk,
`/robots.txt` memuat sitemap; (5) halaman toko/produk punya title,
description, canonical, OG, dan JSON-LD (cek View Source).

**Yang TIDAK dibangun di Fase 5:** cron transisi status langganan,
auto-debit, notifikasi email/WhatsApp, verifikasi DNS dari sisi server
selain lewat Vercel API (cek DNS langsung dari aplikasi tidak dibuat —
Vercel yang menjadi sumber kebenaran status domain).

## Cron transisi status langganan (2026-11-09)

Jadwal harian yang mengubah status langganan di database — sebelumnya
status hanya dihitung di read-time (`effectiveTier`), jadi toko tetap
jalan benar meski cron belum jalan; cron membuat status DI DATABASE
ikut bergerak (tampilan halaman Langganan, audit log, dan notifikasi
pemilik toko jadi benar).

**Cara kerja:** Vercel Cron (lihat `vercel.json`, jadwal `0 0 * * *` =
07:00 WIB setiap hari; timing Hobby hanya dijamin dalam sejam, satu run
bisa telat ~1 jam) memanggil `GET /api/cron/subscription-transitions`.
Route memakai service_role dan memanggil
`runSubscriptionTransitions()` di `src/lib/subscription-transitions.ts`:

- TRIALING yang `trial_ends_at`-nya lewat → tier Free, status ACTIVE
  (trial selesai, toko jadi Free).
- ACTIVE berbayar yang `current_period_end`-nya lewat → PAST_DUE +
  `grace_ends_at` = akhir periode + 7 hari (toko tetap jualan, fitur
  premium baru terkunci — penegakan di `effectiveTier`).
- PAST_DUE yang masa tenggangnya habis → EXPIRED + tier Free (produk
  di atas batas disembunyikan di read-time, bukan dihapus).
- CANCELLED yang `current_period_end`-nya lewat → tier Free, status
  ACTIVE.
- SUSPENDED dan EXPIRED tidak disentuh cron (SUSPENDED hanya admin).
- Setiap transisi dicatat ke `audit_log` (actor `system`) + notifikasi
  in-app ke pemilik toko (link `/dashboard/subscription`).
- Pengingat H-3 dan H-1 (hari kalender WIB) sebelum trial berakhir dan
  sebelum periode berbayar berakhir — di-dedup per toko + jenis + hari
  (dicek ke tabel `notifications` sebelum mengirim, jadi tidak spam).

**Idempotent & aman diulang:** sesudah status berubah, baris itu tidak
lagi cocok dengan kondisi pemicu; update baris memakai syarat status
lama (`.eq('status', ...)`), jadi dua run bersamaan tidak menggandakan
efek. Satu baris gagal tidak menghentikan baris lain (dicatat di
`summary.errors`).

**Env yang wajib diisi (Vercel Production + `.env.local`):**
- `CRON_SECRET` — secret acak (mis. `openssl rand -base64 32`). Vercel
  Cron mengirim header `Authorization: Bearer <CRON_SECRET>` OTOMATIS
  bila env ini diset; JANGAN tulis secret di URL/vercel.json. Tanpa env
  ini route mengembalikan 401. Tombol manual admin tidak memakai secret
  ini (pakai sesi admin).
- `SUPABASE_SERVICE_ROLE_KEY` — sudah wajib sejak Fase 0.

**Tidak ada migrasi baru untuk cron ini.** `audit_log.action` bebas
teks, `notifications.type` bebas teks, dan dedup pengingat memakai
query ke tabel `notifications` yang sudah ada (Fase 3).

**Cara test manual:**
1. Sebagai admin, buka `/dashboard/admin/subscriptions` → seksi
   "Transisi langganan (cron harian)" → "Jalankan transisi sekarang".
   Hasilnya tampil sebagai ringkasan (diproses, transisi per jenis,
   pengingat dikirim, yang dilewati karena duplikat).
2. Simulasi tanggal lewat SQL (Supabase SQL Editor) — ubah satu toko
   trial agar berakhir kemarin, lalu jalankan tombol di atas:
   `update public.subscriptions set trial_ends_at = now() - interval '1 day', current_period_end = now() - interval '1 day' where store_id = '<id-toko>';`
   Harusnya: status jadi Free/ACTIVE + audit log
   `subscription_trial_ended` + notifikasi ke pemilik toko. Kembalikan
   bila perlu: set `trial_ends_at`/`current_period_end` ke tanggal
   depan dan status/tier semula (atau buat trial baru lewat register).
   Simulasi PAST_DUE→EXPIRED: set `status = 'PAST_DUE',
   grace_ends_at = now() - interval '1 day'` pada toko berbayar.
   Simulasi pengingat H-3: set `trial_ends_at` ke 3 hari lagi (WIB)
   lalu jalankan tombol — notifikasi `TRIAL_ENDING_SOON` terkirim
   sekali; jalankan tombol kedua kalinya di hari yang sama — pengingat
   dilewati (duplikat).
3. Cek route cron langsung (butuh CRON_SECRET):
   `curl -H "Authorization: Bearer <CRON_SECRET>" https://cuan.is-a.web.id/api/cron/subscription-transitions`
   Tanpa header → 401.

**Perilaku bila cron belum jalan:** tidak ada yang rusak — status
efektif tetap dihitung benar di read-time (`effectiveTier`), toko tetap
jualan. Yang tertinggal hanya status di database (mis. trial yang sudah
habis masih tertulis TRIALING) sampai cron berikutnya jalan atau admin
menekan tombol manual.

**Yang TIDAK dibangun di cron ini:** auto-debit/perpanjangan otomatis
(pembayaran langganan tetap manual + verifikasi admin), dan pengingat
sebelum masa tenggang habis (pemilik sudah diberi tahu saat masuk PAST_DUE).
Pengingat + transisi di atas sekarang juga dikirim lewat email (Resend)
dan WhatsApp (Meta Cloud API) — lihat bagian "Notifikasi email +
WhatsApp" di bawah; sebelum bagian itu ada, hanya in-app yang jalan.

## Notifikasi email + WhatsApp (2026-11-09)

Satu dispatcher terpusat `src/lib/notify.ts` — `dispatchNotify()` menulis
notifikasi in-app (pakai `notifyUser` Fase 3) + mengirim email (Resend) +
WhatsApp (Meta Cloud API) sesuai preferensi penerima. Semua event
melewati dispatcher yang sama; tidak ada duplikasi logika kirim.

**Event yang di-wire** (in-app + email + WA, sesuai preferensi):
- Order dibuat → seller (`ORDER_CREATED`).
- Pembayaran terkonfirmasi → buyer + seller (`ORDER_PAID`; QRIS lunas
  otomatis via webhook ShopeePay → `QRIS_PAID`, isi sama).
- Bukti bayar diunggah → seller (`PAYMENT_PROOF_UPLOADED`).
- Order dikirim → buyer, sertakan resi (`ORDER_SHIPPED`).
- Order selesai → buyer (`ORDER_COMPLETED`).
- Order dibatalkan → buyer + seller (`ORDER_CANCELLED`).
- Pembayaran langganan diverifikasi / ditolak admin → seller
  (`SUBSCRIPTION_VERIFIED` / `SUBSCRIPTION_REJECTED`).
- Staff ditambahkan → staff (`STAFF_ADDED`).
- Transisi cron + pengingat H-3/H-1 → seller (dipanggil dari
  `runSubscriptionTransitions`, logika transisi + dedup tidak berubah).

**Aturan pengiriman:** dispatcher TIDAK PERNAH melempar dan tidak boleh
memperlambat request utama — pemanggil di alur panas (checkout,
konfirmasi bayar, webhook, ubah status) memakai fire-and-forget
(`void dispatchNotify(...)` / `void notifyOrderEvent(...)`); cron yang
memang background memakai `await`. Kegagalan satu channel hanya dicatat
ke observability (`logEvent('notify_dispatch', { type, email, whatsapp,
... })`); channel lain + in-app tetap jalan.

### 1. Migrasi — preferensi penerima

Jalankan di Supabase SQL Editor, SETELAH migrasi Fase 0–5:

1. **`migrations/20261109_notification_prefs.sql`** — tabel
   `notification_preferences` (1 baris per user; tidak ada baris =
   semua aktif). Idempotent; RLS owner-only + admin baca.
   Kolom: `user_id`, `email_enabled` (default true),
   `whatsapp_enabled` (default true), `whatsapp_number` (nullable).

Pengaturan: buyer di `/akun/notifikasi`, seller di
`/dashboard/notifications` (toggle email/WA + nomor WA khusus).
Bila nomor WA kosong, dispatcher memakai fallback berurutan:
`whatsapp_number` preferensi → nomor HP alamat terakhir pembeli
(`buyer_addresses.phone`) → nomor HP order terakhir pembeli
(`orders.customer_phone`) → nomor WhatsApp toko (`stores.whatsapp`,
untuk pemilik toko). Email diambil dari akun auth pengguna
(`auth.users`, lewat service_role). Pembeli tamu tidak punya email —
email dilewati, WA tetap bisa jalan lewat `customer_phone` dari order.

**Perilaku sebelum migrasi dijalankan:** dispatcher memakai default
(semua aktif) + fallback nomor di atas; halaman pengaturan menampilkan
pesan "jalankan migrasi dulu" (bukan crash). In-app tetap jalan.

### 2. Email — Resend (gratis)

Paket gratis Resend (permanen, tanpa kartu kredit, tanpa overage):
**3.000 email/bulan, maks 100/hari.** Bila cap tercapai, pengiriman
berhenti (API mengembalikan error) — tidak ada tagihan mendadak.
Template email HTML sederhana (template string, tanpa React Email),
Bahasa Indonesia, dengan link ke halaman terkait.

**Cara daftar + isi env:**
1. Daftar gratis di https://resend.com/signup (tanpa kartu kredit).
2. Dashboard → API Keys → Create API Key → salin nilainya.
3. Isi di Vercel (Production) + `.env.local`: `RESEND_API_KEY`,
   `RESEND_FROM` (lihat `.env.local.example`).
4. **Verifikasi domain CUAN (untuk kirim ke semua orang):** Resend →
   Domains → Add Domain → `cuan.is-a.web.id` → pasang record DNS yang
   diminta di pengelola DNS `is-a.web.id` → tunggu status Verified. Lalu set
   `RESEND_FROM=CUAN <noreply@cuan.is-a.web.id>` (sudah diset di Vercel).
5. **Tanpa domain terverifikasi, Resend HANYA bisa mengirim ke alamat
   email pemilik akun Resend itu.** Jadi untuk tes awal: set
   `RESEND_FROM=CUAN <onboarding@resend.dev>` dan kirim tes ke email
   pemilik akun (lihat "Cara test" di bawah).

Tanpa `RESEND_API_KEY`, email dilewati diam-diam (status `skipped` di
log) dan in-app + WA tetap jalan.

### 3. WhatsApp — Meta Cloud API (resmi, BERBAYAR per pesan)

**Biaya jujur — baca dulu sebelum mengaktifkan:**
- Akses API-nya gratis, tapi tiap pesan **template utility** yang
  dikirim proaktif (di luar jendela balasan pelanggan) **ditagih Meta
  Rp356,65/pesan** (rate card 1 Okt 2026, Indonesia). Contoh: 100
  notifikasi order/bulan ≈ Rp35.665/bulan.
- Yang gratis hanya **1.000 service reply/bulan per nomor** — yaitu
  balasan atas chat yang DIMULAI pelanggan. Notifikasi proaktif di sini
  BUKAN service reply, jadi tidak gratis.
- Karena itu channel ini **env-gated dan NONAKTIF bila env belum
  diisi** — tanpa token, WA dilewati diam-diam dan in-app + email
  tetap jalan. **JANGAN** jadikan Fonnte/Wablas/dll sebagai default:
  berbayar bulanan + tidak resmi (risiko nomor diblokir Meta).

**Cara setup:**
1. https://developers.facebook.com → buat aplikasi → tambah produk
   **WhatsApp** → buat / pilih WhatsApp Business Account (WABA) +
   nomor pengirim.
2. Salin **Phone Number ID** (WhatsApp → API Setup).
3. Buat token akses permanen: buat **System User** (Business Settings
   → Users → System Users → Add, beri akses WhatsApp) → Generate New
   Token (izin `whatsapp_business_messaging`). Token sementara dari
   API Setup hanya bertahan 24 jam — jangan pakai untuk produksi.
4. Isi di Vercel (Production) + `.env.local`:
   `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`.
5. **Buat + minta persetujuan template** (WhatsApp Manager →
   Account Tools → Message Templates, kategori **Utility**, bahasa
   `id`). Nama default yang dipakai kode (ubah lewat env
   `WHATSAPP_TEMPLATE_<JENIS>` bila namamu berbeda):
   `cuan_order_created`, `cuan_order_paid`, `cuan_payment_proof`,
   `cuan_order_shipped`, `cuan_order_completed`, `cuan_order_cancelled`,
   `cuan_subscription_reminder`, `cuan_subscription_update`,
   `cuan_subscription_verified`, `cuan_subscription_rejected`,
   `cuan_staff_added`, `cuan_test`.
   **Parameter body `{{1}}..{{n}}` harus cocok urutannya** dengan
   `buildWhatsAppTemplateParams` di `src/lib/notify.ts`, mis.
   `cuan_order_paid` (buyer): {{1}} nama toko, {{2}} nomor invoice,
   {{3}} total; (seller): {{1}} nama customer, {{2}} nomor invoice,
   {{3}} total. Template yang belum disetujui Meta = pengiriman gagal
   (tercatat di log, alur utama tetap jalan).

### 4. Cara test

1. **Halaman test admin** (admin-only): `/dashboard/admin/notifications`
   — menampilkan status konfigurasi (env terisi/belum) + form kirim
   tes: email tes ke email admin sendiri, WA tes ke nomor yang diisi,
   hasil tampil per channel (`Terkirim` / `Dilewati` / `Gagal` +
   alasan).
2. **Test email tanpa domain terverifikasi:** set
   `RESEND_FROM=CUAN <onboarding@resend.dev>`, lalu kirim tes dari
   halaman admin — email masuk ke email pemilik akun Resend (harus
   sama dengan email admin yang login; bila berbeda, email dilewati
   Resend dengan error "can only send to your own email").
3. **Test WA bila nanti diaktifkan:** isi token + Phone Number ID,
   buat + tunggu persetujuan template `cuan_test` (1 parameter),
   lalu kirim tes dari halaman admin ke nomor HP sendiri. Ingat:
   tiap tes WA = 1 pesan utility berbayar (Rp356,65).
4. **Test end-to-end event:** sebagai buyer login, checkout 1 produk
   (COD, toko sendiri) → seller terima in-app + email + WA
   `ORDER_CREATED`; seller konfirmasi pembayaran → buyer terima
   `ORDER_PAID`; seller input resi → buyer terima `ORDER_SHIPPED`
   berisi nomor resi. Cek log Vercel dengan filter
   `notify_dispatch` untuk hasil per channel.
5. **Test cron:** ubah satu toko trial agar berakhir 3 hari lagi,
   lalu tekan "Jalankan transisi sekarang" di
   `/dashboard/admin/subscriptions` — pengingat `TRIAL_ENDING_SOON`
   terkirim (in-app + email + WA) sekali; jalankan kedua kalinya di
   hari yang sama — pengingat dilewati (dedup).

### 5. Perilaku bila provider belum dikonfigurasi

| Keadaan | In-app | Email | WhatsApp |
|---|---|---|---|
| Tanpa `RESEND_API_KEY` | jalan | dilewati | — |
| Tanpa token / Phone Number ID WA | jalan | jalan | dilewati |
| Tanpa keduanya | jalan | dilewati | dilewati |
| Nomor WA penerima kosong | jalan | jalan | dilewati |
| Preferensi channel dimatikan user | jalan | dilewati | dilewati |
| Cap Resend 100/hari tercapai | jalan | gagal (log) | jalan |

**Yang TIDAK dibangun di sini:** auto-debit, pengiriman WA service
reply (balasan chat pelanggan — butuh webhook inbound + jendela 24 jam,
bukan notifikasi proaktif), template WA interaktif (tombol/daftar),
dan pengiriman email massal/newsletter (batas 100/hari Resend gratis
tidak cocok untuk itu).
