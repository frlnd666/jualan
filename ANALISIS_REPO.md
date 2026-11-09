# Analisis Repo `jualan` (CUAN / UMKM Storefront)

Tanggal analisis: 9 November 2026 · Branch: `arena/2ee235f7-jualan` · Commit dasar: `58098d4`
Cakupan: **seluruh 232 file** di repo (174 di `src/`, 17 test, 14 migrasi SQL, aset publik, konfigurasi).

---

## 1. Ringkasan eksekutif

Repo ini adalah aplikasi **multi-tenant storefront untuk UMKM Indonesia** dengan nama produk **CUAN**, dibangun di atas Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Tailwind 4, Supabase (Postgres + Auth + Storage + RLS), Cloudinary, dan Vercel (hosting, cron, domains API). Model bisnisnya SaaS bertingkat: **Free / Silver (Rp19.900/bln) / Gold (Rp50.000/3 bln)** dengan trial Silver 14 hari.

Kualitas rekayasa di atas rata-rata untuk proyek sekelas ini:

- Dokumentasi keputusan **sangat rapi** (komentar panjang berbahasa Indonesia di hampir setiap file, README Supabase memuat urutan aktivasi migrasi per fase, `verify_live_schema.sql` read-only untuk membandingkan skema live vs rekonstruksi).
- **Pemisahan logika murni vs efek samping** sangat konsisten: `lib/*.ts` bebas database dan dites, `lib/actions/*.ts` memegang otorisasi + penulisan.
- **184 unit test lulus**, `tsc --noEmit` bersih, ESLint **0 error** (16 warning).
- Keamanan sudah dipikirkan serius: RLS per tabel, service-role hanya di server, token invoice acak, `decrement_stock` atomik via RPC, verifikasi signature webhook, enkripsi AES-256-GCM untuk kredensial ShopeePay.

Namun ada **beberapa cacat yang berdampak nyata**, termasuk satu **stored XSS** di halaman publik, satu **lubang RLS** yang membuat detail pesanan pembeli kosong, dan satu **kebocoran data rekening semua penjual**.

**Skor kematangan (0–10):**

| Area | Skor | Catatan |
|---|---|---|
| Arsitektur & struktur kode | 8.5 | Modul lib/actions/components jelas, konvensi konsisten |
| Fitur & kelengkapan alur bisnis | 7.0 | Alur inti lengkap; pembayaran manual belum menampilkan tujuan bayar |
| Keamanan & otorisasi | 6.5 | Fondasi kuat, tetapi ada XSS + 1 policy hilang + 1 policy terlalu terbuka |
| Kinerja & skala | 5.5 | Middleware berat, N+1 di sitemap, rate limit per-instance |
| Kualitas & pengujian | 7.0 | Unit test bagus & lulus; tidak ada test untuk server action/RLS/e2e |
| Operasional & observability | 7.0 | Health check, audit log, cron idempotent; env contoh belum lengkap |

**Kesimpulan satu kalimat:** fondasinya solid dan siap dikembangkan, tetapi **jangan go-live lebih luas sebelum 5 temuan P0/P1 pertama di §7 ditutup**.

---

## 2. Metode pemeriksaan & hasil verifikasi

Yang dijalankan (bukan sekadar dibaca):

```
npm install --legacy-peer-deps --ignore-scripts   → 665 paket, 27 dtk
npx tsc --noEmit                                  → 0 error
npx eslint .                                      → 0 error, 16 warning
npx vitest run                                    → 16 file, 184 test, semua lulus
npx next build                                    → GAGAL (hanya karena sandbox tidak bisa
                                                    mengakses fonts.googleapis.com)
git ls-files                                      → 232 file terlacak
```

Build gagal **bukan bug repo**: `src/app/layout.tsx` memakai `next/font/google` (`Inter`), dan sandbox ini hanya punya akses ke GitHub/npm/PyPI. Di GitHub Actions (punya internet) build seharusnya lolos. Tetap dicatat sebagai titik rapuh: build produksi bergantung pada ketersediaan Google Fonts saat build.

Peringatan ESLint: 13× `<img>` (disarankan `next/image`) dan 1× dependensi `useEffect` di `dashboard/shipping/page.tsx`, 1× `eslint-disable` tak terpakai di checkout, 1× variabel `options` tak terpakai di middleware.

---

## 3. Peta arsitektur

```
Browser
  │
  ├─ middleware.ts  ── resolve host (platform / subdomain / custom domain)
  │                    + refresh sesi Supabase + guard /dashboard
  │
  ├─ src/app/[storeSlug]/...        storefront publik (SSR, anon key)
  ├─ src/app/checkout, cart         keranjang (zustand persist) + server action
  ├─ src/app/invoice/[no]?t=token   halaman publik gabungan invoice + tracking
  ├─ src/app/akun/*                 area pembeli (login)
  ├─ src/app/dashboard/*            area penjual/staff (login, per-peran)
  ├─ src/app/dashboard/admin/*      area admin platform (rpc is_admin())
  └─ src/app/api/*                  health, webhook ShopeePay, polling QRIS, cron

Lapisan data
  ├─ lib/supabase/server.ts   → createServerClient (cookies, RLS aktif, anon key)
  ├─ lib/supabase/client.ts   → createBrowserClient (RLS aktif, anon key)
  ├─ lib/supabase/admin.ts    → service_role (bypass RLS), HANYA server
  └─ lib/invoice-access.ts    → createPublicInvoiceClient(): admin bila ada, anon bila tidak

Logika bisnis murni (dites unit)
  subscription-tiers, subscription-transitions, subscriptions, vouchers, flash-sales,
  shipping, analytics, access-rules, domains, store-links, seo, order-status,
  product-image, rate-limit, privacy, utils/order, shopeepay/{crypto,payload}
```

**Pola penting yang dipakai konsisten:**

1. **Mutasi berizin = server action**, bukan tulis langsung dari browser — kecuali 3 halaman dashboard yang masih menulis langsung lewat client anon (settings, shipping, produk edit). Lihat §6 K-10.
2. **Graceful degradation**: setiap fitur baru (token invoice, `buyer_id`, voucher, berat, flash sale, banner, audit log, domain) punya fallback bila migrasinya belum dijalankan. Ini alasan aplikasi bisa hidup di masa transisi, tetapi juga berarti **kegagalan konfigurasi jarang terlihat sebagai error** (lihat K-04).
3. **Tier ditegakkan di server** (`createProductAction`, voucher, flash sale, banner, domain, export analitik) dengan UI hanya sebagai cermin.

---

## 4. Alur bisnis yang terbaca dari kode

### 4.1 Penjual
`/register` (pilih paket, disimpan di `localStorage`) → `/dashboard/onboarding` 5 langkah (info toko → rekening/QRIS → pengiriman → produk pertama → selesai) → `/dashboard` (statistik) → produk, pesanan, chat, banner, flash sale, voucher, analitik, langganan, domain.

- Langganan dibuat **malas** oleh `ensureStoreSubscription` saat toko pertama dibuat (Free/ACTIVE, atau Silver/TRIALING bila paket trial dipilih).
- Pembayaran langganan manual: penjual memilih tier + metode + unggah bukti → baris `subscription_payments` PENDING → admin verifikasi → `subscriptions` diubah lewat service_role + audit log.
- **Cron harian 07:00 WIB** (`vercel.json` → `GET /api/cron/subscription-transitions`, `Authorization: Bearer CRON_SECRET`) menjalankan TRIALING→Free, ACTIVE→PAST_DUE(+7 hari), PAST_DUE→EXPIRED→Free, CANCELLED→Free, plus pengingat H-3/H-1 yang di-dedup per toko+jenis+hari. Desain idempotensinya benar: update bersyarat `.eq('status', status_lama)` + `select('id')` untuk memastikan efek samping tidak dobel.

### 4.2 Pembeli
Storefront → produk → keranjang (zustand, satu toko per keranjang) → checkout 3 langkah (alamat → pengiriman → pembayaran) → server action `createOrderAction` → invoice publik ber-token → upload bukti → penjual konfirmasi → resi → selesai. Pembeli yang login mendapat keranjang tersimpan, buku alamat, riwayat pesanan, dan notifikasi in-app.

### 4.3 Pembayaran
- **Manual** (BANK_TRANSFER/QRIS): bukti transfer diunggah ke bucket privat `payment-proofs`, status invoice → `WAITING_VERIFICATION`, seller konfirmasi → `PAID` + order `PROCESSING`.
- **QRIS dinamis ShopeePay** (opsional per toko): kredensial toko terenkripsi, token B2B RSA-SHA256, generate QR MPM HMAC-SHA512, webhook `POST /api/shopeepay/notify` sebagai sumber kebenaran, polling `/api/qris/status` + inquiry sebagai cadangan. Semua kegagalan jatuh ke alur manual — keputusan desain yang tepat.
- **COD**: hanya untuk tier berbayar; penjual menandai lunas tanpa bukti.

### 4.4 Tier & pembatasan
`TIER_LIMITS`: Free 4 produk/1 foto/0 staff/watermark/iklan afiliasi/COD saja; Silver 30/5/1/voucher/flash sale; Gold 175/10/3/+export/domain. Penurunan tier **menyembunyikan**, tidak menghapus (`effectiveTier` dihitung read-time).

---

## 5. Basis data & RLS

14 file migrasi, dijalankan berurutan per fase (P0 → P0b → P1 → P2 → F0 → F0 RPC → F0 roles → F1 → F2 → F3 → F4 → F5). Semua idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `CREATE OR REPLACE`).

**Tabel utama:** `stores`, `product_categories`, `products`, `shipping_methods`, `orders`, `order_items`, `invoices`, `shipments`, `chat_sessions`, `chat_session_messages`, `profiles`, `subscriptions`, `subscription_payments`, `buyer_addresses`, `buyer_carts`, `buyer_cart_items`, `store_shopeepay_credentials`, `qris_payments`, `vouchers`, `voucher_redemptions`, `notifications`, `flash_sales`, `store_banners`, `audit_log`, `store_domains`.

**Matriks policy (ringkas):**

| Tabel | anon | authenticated | Catatan |
|---|---|---|---|
| stores | SELECT semua | owner CRUD | **termasuk rekening bank** → K-03 |
| products | SELECT semua | owner/staff CRUD | produk nonaktif pun terbaca |
| shipping_methods | SELECT semua | owner CRUD | staff tidak |
| orders | ✗ | owner, staff, buyer (sendiri) | insert hanya service_role |
| order_items | ✗ | owner, staff | **buyer TIDAK ada** → K-02 |
| invoices | ✗ | owner, staff, buyer (sendiri) | update owner/staff |
| shipments | ✗ | owner, staff | **buyer TIDAK ada** → K-02 |
| profiles | ✗ | diri sendiri (insert role harus `buyer`), admin | trigger blokir eskalasi role/store_id |
| subscriptions | ✗ | owner SELECT, admin UPDATE | tulis lewat service_role |
| subscription_payments | ✗ | owner SELECT/INSERT, admin UPDATE | INSERT tidak membatasi `status` → K-10b |
| vouchers / flash_sales / store_banners | SELECT khusus aktif | owner all | divalidasi server-side saat checkout |
| qris_payments | ✗ | owner, buyer | tulis service_role |
| notifications | ✗ | penerima | INSERT sendiri diizinkan (self-only) |
| audit_log | ✗ | admin SELECT | tulis service_role |
| store_domains | SELECT verified | owner all, admin | dipakai middleware |
| storage payment-proofs | ✗ (privat) | ✗ | hanya service_role |
| storage product-images | SELECT | INSERT/UPDATE semua user login | **tanpa batas folder/ukuran** → K-07 |

Fungsi SECURITY DEFINER yang ada: `is_admin()`, `is_staff_of_store(uuid)`, `decrement_stock`/`increment_stock` (dengan `FOR UPDATE` + cek kepemilikan toko), `prevent_role_escalation`, `set_*_updated_at`. Ini praktik yang benar.

---

## 6. Temuan

Tingkat: **Kritis** (harus segera) · **Tinggi** · **Sedang** · **Rendah**.

### K-01 — Stored XSS lewat JSON-LD di storefront dan halaman produk · **KRITIS**

`src/app/[storeSlug]/page.tsx:259` dan `src/app/[storeSlug]/products/[slug]/page.tsx:165`:

```tsx
<script type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd({ ...store })) }} />
```

`JSON.stringify` **tidak** meng-escape `</script>`. Nama/deskripsi toko dan produk berasal dari input penjual (form pengaturan/onboarding, tanpa sanitasi). Deskripsi berisi `Toko </script><img src=x onerror=...>` akan keluar dari tag script dan dieksekusi sebagai HTML. CSP di `next.config.ts:21` memuat `script-src 'self' 'unsafe-inline' 'unsafe-eval'`, jadi `<script>` inline yang disuntikkan **ikut berjalan** — bukan sekadar CSP-blocked.

Dampak: XSS tersimpan di origin utama. Karena cookie sesi Supabase dibaca oleh browser client (`@supabase/ssr`), skrip dapat bertindak sebagai penjual yang sedang membuka tokonya, atau sebagai admin yang meninjau toko tersebut (dashboard admin menautkan "Lihat Toko").

Perbaikan minimal (1 baris per lokasi):

```ts
const safeJsonLd = (v: unknown) =>
  JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
```

Tambahan: hilangkan `'unsafe-eval'` di produksi, dan pertimbangkan nonce/hash untuk `'unsafe-inline'`.

### K-02 — Pembeli tidak bisa melihat item pesanan dan resi (policy RLS hilang) · **TINGGI (fungsional)**

`src/app/akun/pesanan/[id]/page.tsx:61` dan `:74` membaca `order_items` dan `shipments` memakai **client sesi pembeli**. Policy yang ada hanya `order_items_owner_select` / `order_items_staff_select` dan `shipments_owner_all` / `shipments_staff_*` — **tidak ada policy untuk pembeli**. Hasilnya: halaman detail pesanan pembeli menampilkan daftar item kosong dan "belum ada info pengiriman", tanpa error yang terlihat.

Perbaikan (migrasi baru):

```sql
create policy order_items_buyer_select on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
     where o.id = order_items.order_id and o.buyer_id = auth.uid()
  ));

create policy shipments_buyer_select on public.shipments
  for select to authenticated
  using (exists (
    select 1 from public.orders o
     where o.id = shipments.order_id and o.buyer_id = auth.uid()
  ));
```

Alternatif: baca lewat service_role di server component setelah memverifikasi `buyer_id`.

### K-03 — Seluruh baris `stores` (rekening, QRIS, WhatsApp, alamat) bisa dibaca publik · **TINGGI (privasi)**

`supabase/migrations/20261107_p0_security.sql:66`:

```sql
create policy "stores_public_read" on public.stores for select using (true);
```

Anon key ikut terkirim ke browser, jadi siapa pun bisa `GET /rest/v1/stores?select=*` dan mengunduh **nomor rekening + nama pemilik rekening + URL QRIS + nomor WhatsApp + owner_id** semua penjual. Ini bukan hanya masalah privasi penjual: data itu adalah target penipuan ("transfer ke rekening X").

Catatan: kode server sebenarnya hanya butuh kolom publik (`name, slug, description, city, logo_url, banner_url, instagram`) untuk storefront, dan kolom pembayaran hanya untuk halaman invoice.

Perbaikan yang disarankan: pisahkan data sensitif ke `store_payment_details` (owner-only + service_role), atau cabut `SELECT` kolom sensitif dari `anon`/`authenticated` dan baca lewat service_role di server component. `createPublicInvoiceClient()` sudah menyediakan jalur service_role.

### K-04 — Checkout & fitur berbayar bergantung mutlak pada `SUPABASE_SERVICE_ROLE_KEY`, gagal secara senyap · **TINGGI (operasional)**

`src/lib/actions/checkout.ts:77` memakai `createPublicInvoiceClient()`, yang jatuh ke client anon bila service role tidak diset (`src/lib/invoice-access.ts:20`). Karena `orders` **tidak punya policy INSERT**, checkout tamu akan gagal total. Lebih halus lagi: `getStoreSubscription()` dengan client anon tidak bisa membaca `subscriptions` (policy owner/admin), sehingga mengembalikan `FREE_SUBSCRIPTION` → storefront menyembunyikan produk di atas 4, memberi watermark, dan checkout hanya menawarkan COD — **tanpa pesan error**. Toko berbayar tampak "turun paket".

Rekomendasi: fail-fast eksplisit (kembalikan 503 + pesan "konfigurasi server belum lengkap" di `/api/health` dan di checkout), atau pindahkan pembacaan tier ke jalur yang selalu service_role dan gagalkan bila tidak ada. Saat ini `/api/health` baru menandai `degraded`, tidak memblokir.

### K-05 — Detail rekening/QRIS toko dikumpulkan, tetapi tidak pernah ditampilkan ke pembeli · **TINGGI (produk)**

`bank_name`, `bank_account_name`, `bank_account_number`, `qris_image_url` diisi pada onboarding langkah 2, tetapi:

- halaman invoice hanya menulis *"Gunakan detail tujuan (nomor rekening / kode QR) yang diberikan penjual — tanyakan lewat tombol Chat penjual"* (`src/app/invoice/[invoiceNumber]/page.tsx:302`),
- halaman pengaturan tidak punya bagian untuk mengubah rekening (hanya `profil | kontak | tampilan`),
- storefront tidak menampilkannya.

Akibatnya pembayaran nontunai non-QRIS-dinamis bergantung pada penjual mengirim rekening manual via chat. Ini gap UX terbesar di alur uang. Saran: blok "Tujuan pembayaran" di invoice (server-side, service role), tombol salin, dan bagian "Pembayaran" di Pengaturan.

### K-06 — Trial Silver bisa diulang; paket register dipercaya dari client · **SEDANG–TINGGI (bisnis)**

`ensureStoreSubscription(storeId, plan)` (`src/lib/actions/subscriptions.ts:90`) menerima `plan` dari pemanggil. Pemanggilnya `dashboard/settings` membaca `localStorage` (`src/app/dashboard/settings/page.tsx:239`) — nilai yang bisa diubah siapa pun lewat devtools. Aksi ini juga bisa dipanggil langsung dari console untuk toko yang belum punya baris langganan. Ditambah `stores_owner_delete` mengizinkan pemilik menghapus tokonya, lalu membuat toko baru dan mengulang trial 14 hari tanpa batas.

Saran: tentukan paket dari server (tabel `register_intents`/kolom di `profiles`), batasi trial per `auth.users.id` (bukan per toko), dan catat `trial_used_at`.

### K-07 — Upload gambar terbuka untuk semua akun login, tanpa kuota/tipe di server · **SEDANG**

`product-images` bucket: policy `for insert/update to authenticated with check (bucket_id = 'product-images')` — **tanpa** pembatasan folder, ukuran, atau MIME. Halaman produk mengunggah langsung dari browser (`src/app/dashboard/products/new/page.tsx:120`). Artinya setiap pembeli terdaftar bisa mengunggah file besar/berulang ke storage platform.

Paralel: `getCloudinarySignature` (`src/lib/actions/cloudinary-sign.ts:22`) hanya mensyaratkan login, jadi akun mana pun bisa meminta tanda tangan upload ke akun Cloudinary platform dengan folder `jualan`.

Saran: policy berbasis folder `(storage.foldername(name))[1] = auth.uid()::text` atau cek kepemilikan toko via RPC, batas ukuran bucket, `allowed_mime_types`, dan batasi signature Cloudinary ke owner/staff toko.

### K-08 — `confirmPayment` tidak menjaga status order/invoice secara atomik · **SEDANG**

`src/lib/actions/confirm-payment.ts:83-105` meng-update invoice → `PAID` lalu order → `PROCESSING` hanya dengan `.eq('id', ...)`, tanpa syarat status lama. Dua klik beruntun atau balapan dengan pembatalan bisa mengubah order `CANCELLED`/`COMPLETED` menjadi `PROCESSING` (dan stok yang sudah dikembalikan tidak dikurangi lagi). Cek "sudah PAID" hanya untuk invoice, bukan status order.

Saran: `.eq('status', 'PENDING_PAYMENT')` + `in('payment_status', [...])` dan cek hasil update; idealnya satu RPC transaksional.

### K-09 — Audit log perubahan harga bisa dipalsukan penjual · **SEDANG (integritas)**

`logPriceChangedAction` (`src/lib/actions/audit.ts:79`) memverifikasi pemanggil punya toko, tetapi **tidak** memverifikasi `productId` milik toko itu, dan mempercayai `oldPrice`/`productName` dari client. Penjual bisa menulis entri audit palsu (produk toko lain, harga fiktif). Saran: baca produk dari DB dengan `.eq('store_id', access.store.id)`, ambil harga lama dari DB, dan bandingkan dengan harga baru setelah update.

### K-10 — Penulisan langsung dari browser & policy yang terlalu longgar · **SEDANG**

- `dashboard/settings/page.tsx` dan `dashboard/shipping/page.tsx` menulis `stores`/`shipping_methods` langsung dengan client anon. Aman secara RLS (owner-only), tetapi validasi (slug reserved, panjang) hanya di client; onboarding memakai `slugify` sendiri yang **tidak** memeriksa `RESERVED_STORE_SLUGS` dan panjang minimum (`src/lib/actions/onboarding.ts:96`), sehingga bisa lahir slug `login`/`api` (bertabrakan dengan route) atau 1–2 karakter.
- `dashboard/products/[id]/page.tsx:238` meng-update produk langsung, dan hanya mendukung **satu** foto (`images: imageUrl ? [imageUrl] : []`) padahal tier Silver/Gold mengizinkan 5/10 foto — fitur paket tidak bisa dipakai lewat edit.
- `subscription_payments_insert_owner` tidak membatasi `status`/`amount`, jadi penjual bisa menyisipkan baris `VERIFIED`/`amount=0` (tidak mengubah `subscriptions`, tapi mengotori riwayat yang dibaca admin).

### K-11 — Rate limiter in-memory per instance · **SEDANG**

`src/lib/rate-limit.ts` menyatakan sendiri batasannya. Di Vercel serverless setiap instance punya `Map` sendiri; limit checkout (5/10 menit per nomor, 20/10 menit per IP) mudah dilewati dengan menambah instance/region. Untuk anti-spam serius perlu limiter terdistribusi (Upstash/Redis) atau rate limit di edge/WAF.

### K-12 — `middleware.ts` sudah deprecated di Next 16 dan relatif berat · **SEDANG**

`node_modules/next/dist/docs/.../proxy.md:11` menyatakan konvensi `middleware` **deprecated dan diganti `proxy`**. Repo memakai `middleware.ts` + `export async function middleware`; build masih jalan (hanya deprecated), tetapi codemod tersedia: `npx @next/codemod@canary middleware-to-proxy .`.

Selain itu matcher `/((?!_next/static|_next/image|favicon.ico).*)` **tidak mengecualikan** `.svg/.jpg/.js/.woff2` dari `public/`, `sw.js`, maupun semua route API. Akibatnya setiap request aset publik dan **setiap webhook ShopeePay** menjalankan `createServerClient` + `supabase.auth.getUser()` (panggilan jaringan). Untuk host custom, ditambah 1–2 query `store_domains`/`stores` per request. Ini menambah latensi di jalur pembayaran yang sensitif.

Saran: pindahkan pengecekan host/auth ke `proxy.ts`, persempit matcher (kecualikan ekstensi statis dan `/api/*`), dan cache hasil resolusi domain (mis. `unstable_cache`/header).

### K-13 — Analitik bisa memecah URL PostgREST · **SEDANG**

`src/lib/actions/analytics.ts:45-62`: ambil hingga 5000 order, lalu `.in('order_id', orderIds)` untuk `order_items` **dan** `invoices`. Dengan UUID 36 karakter, 5000 id ≈ 185 KB query string → berisiko `414 URI Too Long`/`431` pada toko besar. Saran: query per batch 200–500 id, atau join lewat view/RPC, atau filter `created_at` di query anak.

### K-14 — Sitemap: N+1 query dan tidak menghormati batas tier · **SEDANG–RENDAH**

`src/app/sitemap.ts:54-56` memanggil `getPublicStoreSubscription(store.id)` satu per satu (hingga 500 toko = 500 query, masing-masing membuat admin client). Sitemap juga memuat **semua** produk `available`, termasuk produk yang disembunyikan karena melebihi batas tier — bot akan menemukan URL yang `notFound()`. Saran: satu query `subscriptions` lalu map di memori, dan terapkan `maxProducts` per toko.

### K-15 — Hitungan notifikasi belum dibaca maksimal 50 · **RENDAH**

`src/lib/actions/notifications.ts:29-45` mengambil 50 baris terbaru lalu menghitung `!is_read`. Bila ada >50 belum dibaca, angka lonceng mentok 50. Saran: query `count` dengan `eq('is_read', false)`.

### K-16 — Token invoice di query string + bypass legacy · **RENDAH–SEDANG**

Token acak UUID (`invoices.access_token`) adalah ide bagus, tetapi dikirim sebagai `?t=` (bisa masuk log/referrer/history), dan `isInvoiceTokenValid(null, apa pun)` mengembalikan `true` untuk invoice tanpa token (`src/lib/invoice-access.ts:44-50`) — celah yang hanya aman setelah migrasi P0 selesai dan semua invoice punya token. Perbandingan string juga tidak constant-time (didokumentasikan). Saran: setelah verifikasi live OK, hapus cabang legacy dan gunakan `timingSafeEqual`.

### K-17 — `invoices.expires_at` tidak disinkronkan saat QR kedaluwarsa · **RENDAH**

Komentar di `src/lib/shopeepay/qris-server.ts:100` menyebut "invoice ikut kedaluwarsa", tetapi `getActiveQrisPayment` hanya meng-update `qris_payments`; `invoices.expires_at` dibiarkan lewat. Perilaku UI masih benar (tombol "buat QR baru"), tetapi datanya tidak konsisten.

### K-18 — Rekening toko hanya bisa diubah lewat wizard onboarding · **RENDAH–SEDANG**

Tidak ada bagian pembayaran di `/dashboard/settings`. Penjual harus membuka `/dashboard/onboarding` lagi untuk mengganti rekening — alur yang tidak intuitif dan berisiko salah edit (langkah onboarding menimpa seluruh kolom pembayaran).

### K-19 — Duplikasi kolom pembayaran legacy · **RENDAH**

`stores` punya `payment_bank_name/payment_account_*` **dan** `bank_name/bank_account_*`; begitu pula `user_id` (legacy) vs `owner_id`. Migrasi F0 mendokumentasikannya dengan jujur; tetap perlu satu kali konsolidasi agar tidak ada penulisan ke kolom yang salah.

### K-20 — Kebersihan repo & tooling · **RENDAH**

- `tsconfig.tsbuildinfo` (156 KB, artefak build) **terlacak git** — seharusnya di `.gitignore`.
- `next-pwa` ada di dependensi tetapi **tidak dipakai** di `next.config.ts` (SW ditulis manual di `public/sw.js`); inilah alasan CI butuh `--legacy-peer-deps`.
- `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` tidak dipakai.
- `package.json` `dev` mengikat `127.0.0.1` → tidak bisa dibuka dari perangkat lain/preview proxy; gunakan `-H 0.0.0.0`.
- `README.md` hanya 146 byte; dokumentasi sebenarnya tersebar di `supabase/README.md` dan komentar kode.

### K-21 — `/api/health` melaporkan `degraded` bila ShopeePay belum diset · **RENDAH**

`requiredEnvStatus().shopeepayEncryptionKey` ikut menentukan `ok`, padahal QRIS dinamis adalah fitur opsional per toko. Monitoring bisa memberi alarm palsu. Pisahkan `readiness` (Supabase + service role) dari `features`.

### K-22 — `.env.local.example` tidak lengkap · **RENDAH**

Kode membaca `NEXT_PUBLIC_PLATFORM_BANK_NAME`, `..._BANK_ACCOUNT`, `..._BANK_HOLDER`, `..._PLATFORM_QRIS_URL` (dipakai `src/lib/subscription-payment-config.ts` dan `requiredEnvStatus`), tetapi keempatnya tidak ada di `.env.local.example`. Operator yang mengikuti contoh akan mendapat halaman langganan tanpa tujuan bayar.

---

## 7. Prioritas perbaikan

### P0 — sebelum menerima trafik nyata (≤ 2 hari)
1. **K-01** escape JSON-LD (2 file, ±5 baris) + hapus `unsafe-eval` dari CSP.
2. **K-02** tambah policy `order_items_buyer_select` & `shipments_buyer_select` (migrasi baru).
3. **K-03** putuskan jalur data rekening: minimal cabut `SELECT` publik kolom sensitif, ganti storefront/invoice ke service_role.

### P1 — sebelum kampanye/banyak penjual (≤ 2 minggu)
4. **K-05** tampilkan tujuan pembayaran di invoice + bagian Pembayaran di Pengaturan.
5. **K-04** fail-fast bila service role tidak ada; jangan menurunkan tier secara senyap.
6. **K-06** plan dari server + batas trial per user.
7. **K-07** batasi upload storage/Cloudinary.
8. **K-08** guard status di `confirmPayment`.
9. **K-10** satukan validasi slug produk/toko lewat `validateStoreSlug`, dukung multi-foto di edit produk.
10. **K-11** limiter terdistribusi untuk checkout/chat.

### P2 — perbaikan berkelanjutan
11. **K-12** migrasi `middleware` → `proxy`, persempit matcher, cache domain.
12. **K-13/K-14** batching analitik, sitemap 1 query.
13. **K-09/K-15/K-16/K-17/K-18/K-19** integritas audit, hitung notifikasi, token, konsistensi data, UX rekening.
14. **K-20–K-22** higiene repo, health, env contoh.
15. Tambah test untuk lapisan yang sekarang kosong: server action (mock Supabase), policy RLS (pgTAP), dan 1–2 alur e2e (Playwright) untuk checkout → invoice → konfirmasi.

---

## 8. Performa (catatan terpisah dari temuan)

- Setiap halaman dashboard melakukan beberapa round-trip berurutan: `auth.getUser()` → `getDashboardAccess()` (2 query) → `rpc('is_admin')` → data. Bisa digabung dalam satu RPC/view.
- `dashboard/layout.tsx` memanggil `getUnreadNotificationCountAction()` yang membuat client baru + `getUser()` lagi.
- `listStaffAction` memanggil `auth.admin.getUserById` per staff (N+1); `findUserIdByEmail` memindai sampai 10.000 user per penambahan staff.
- Storefront memakai `select('*')` pada `stores` (mengambil kolom sensitif yang tidak dipakai) dan melakukan 6–8 query per render (produk, langganan, flash sale, banner, kategori, produk pertama untuk OG).
- Banyak `<img>` tanpa `next/image` → tidak ada optimasi/resizing; LCP berpotensi buruk di jaringan seluler.
- `next.config.ts` sudah punya `remotePatterns` untuk Supabase/Cloudinary/Pexels, jadi migrasi ke `next/image` mudah.

---

## 9. Kualitas kode & pengujian

**Kuat:**
- TypeScript strict, tanpa `any` yang mencolok, tanpa `tsc` error.
- Penamaan dan komentar konsisten; setiap keputusan sulit dijelaskan beserta alasannya (mis. mengapa service role dipakai di checkout, mengapa rollback memakai `increment_stock`).
- Logika murni terpisah membuat 184 test bisa berjalan tanpa database — coverage bagus untuk tier, transisi langganan, voucher, flash sale, ongkir, domain, SEO, kripto ShopeePay, privasi.
- Migrasi idempotent + `verify_live_schema.sql` + urutan aktivasi terdokumentasi: ini yang paling sering hilang di proyek serupa.

**Lemah:**
- Tidak ada test untuk server action (otorisasi, validasi, fallback migrasi), tidak ada test RLS, tidak ada e2e. Semua bug di §6 (K-02, K-08, K-09) berada tepat di lapisan yang tidak dites.
- Tiga file >600 baris (`checkout/page.tsx` 915, `dashboard/shipping/page.tsx` 673, `invoice/[invoiceNumber]/page.tsx` 618) — kandidat pemecahan komponen.
- Banyak `try { } catch { }` kosong (disengaja untuk best-effort), tetapi menyulitkan diagnosis; sebaiknya log minimal dengan `logEvent`.
- Penanganan error server action mengembalikan string, bukan kode error terstruktur — sulit dilokalkan/dites.

---

## 10. Kesiapan operasional (checklist)

**Env yang wajib ada di produksi:**
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, **`SUPABASE_SERVICE_ROLE_KEY`** (tanpa ini checkout mati), `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`.
**Opsional per fitur:** `CLOUDINARY_API_KEY/SECRET`, `SHOPEEPAY_ENCRYPTION_KEY` (+ `SHOPEEPAY_BASE_URL`, `SHOPEEPAY_QR_STATUS_PATH`), `VERCEL_API_TOKEN`, `NEXT_PUBLIC_PLATFORM_DOMAIN`, `NEXT_PUBLIC_PLATFORM_BANK_*`, `NEXT_PUBLIC_PLATFORM_QRIS_URL`.

**Urutan deploy yang benar (dari `supabase/README.md`):** set service role → deploy kode → jalankan P0 → P0b → P1 → P2 → hotfix → F0 → F0 RPC → F0 roles → F1 → F2 → F3 → F4 → F5. Jangan dibalik; halaman invoice/upload akan gagal bila RLS ditutup sebelum service role terpasang.

**Risiko operasional yang masih terbuka:** skema signature webhook ShopeePay dan path inquiry **belum dikonfirmasi** ke dokumen Partner (didokumentasikan jujur di kode); pembayaran langganan manual belum punya tujuan bayar sampai env `NEXT_PUBLIC_PLATFORM_BANK_*` diisi; tidak ada monitoring eksternal (hanya `/api/health`), tidak ada backup/retensi yang terdokumentasi.

---

## 11. Lampiran — inventaris modul

**`src/lib` (logika):** access-rules, admin-access, analytics, audit, cloudinary, dashboard-access, domains, flash-sales, invoice-access, landing-photos, notifications, observability, order-status, payment-proof, product-image, rate-limit, register-plan, seo, shipping, store-links, store-slug, subscription-payment-config, subscription-tiers, subscription-transitions, subscriptions, subscriptions-server, use-cart, vercel-domains, vouchers, utils/{order,privacy}, types/{order}, shopeepay/{crypto,credentials,payload,qris-server,snap}, supabase/{admin,client,server}.

**`src/lib/actions` (25 file):** admin, analytics, audit, buyer-addresses, buyer-cart, chat, chat-seller, checkout, cloudinary-sign, confirm-payment, dashboard-store, domains, flash-sales, notifications, onboarding, order-fulfillment, order-management, qris, shopeepay-credentials, staff, store-banners, subscription-transitions, subscriptions, upload-payment-proof, vouchers.

**Route & halaman:** landing (10 komponen home), storefront + detail produk, cart, checkout, invoice (+track redirect), akun (pesanan, detail, alamat, notifikasi), dashboard (beranda, produk baru/edit, pesanan + detail, payments redirect, pengiriman, langganan, staff, pengaturan, onboarding, domain, banner, flash sale, voucher, analitik, chat, notifikasi, admin ×4), auth (login, register, lupa/reset password, callback), API (health, cron, qris/status, shopeepay/notify, store-id), SEO (sitemap, robots, manifest, icons).

**Test (16 file, 184 kasus):** access-rules, analytics, audit-observability, domains, flash-sales, privacy-and-order, product-image, rate-limit, seo, shipping, shopeepay-crypto, shopeepay-payload, store-slug, subscription-tiers, subscription-transitions, vouchers.

---

### Catatan penutup

Repo ini menunjukkan proses yang matang: setiap fase punya migrasi, dokumentasi, fallback, dan test logika. Yang paling perlu diperbaiki bukan arsitekturnya, melainkan **tiga hal kecil yang berdampak besar**: escape JSON-LD, dua policy RLS yang hilang, dan satu policy yang terlalu terbuka. Setelah itu, fokus berikutnya adalah menampilkan tujuan pembayaran ke pembeli — karena saat ini alur uang masih bergantung pada chat manual.
