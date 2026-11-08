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
