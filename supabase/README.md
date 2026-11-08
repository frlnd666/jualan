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
