-- ============================================================================
-- Fase 0 — Skema inti (2026-11-08): versikan skema inti ke repo.
--
-- Latar: sebelum file ini, repo TIDAK menyimpan skema tabel inti sama sekali.
-- Migrasi yang ada hanya P0/P0b/P1/P2 + hotfix (RLS, kolom tambahan,
-- constraint). Tabel inti dibuat langsung di database live dulu, tanpa
-- jejak di repo. File ini merekonstruksi skema dari KODE APLIKASI
-- (select/insert/update di src/**) + migrasi yang sudah ada, supaya skema
-- bisa di-review, diuji di proyek baru, dan dipakai sebagai dasar
-- penegakan tier (Fase 1).
--
-- CARA PAKAI: jalankan SETELAH migrasi P0/P0b/P1/P2 + hotfix, di Supabase
-- SQL Editor. Aman dijalankan berulang (idempotent): semua CREATE memakai
-- IF NOT EXISTS, semua index memakai IF NOT EXISTS, RLS di-enable ulang.
-- File ini TIDAK menghapus/mengubah data yang sudah ada.
--
-- BATAS KEPASTIAN: tipe kolom / default / constraint yang TIDAK bisa
-- dibuktikan dari kode ditandai NEEDS_LIVE_VERIFY di komentar tiap tabel.
-- Jalankan supabase/verify_live_schema.sql dan bandingkan hasilnya dengan
-- file ini SEBELUM menganggap skema ini final. Bila live berbeda, yang
-- benar adalah live — perbaiki file ini, jangan paksa live mengikuti file.
--
-- YANG SENGAJA TIDAK ADA DI SINI:
-- - Tabel legacy `chats` + `chat_messages`: tidak dipakai kode mana pun
--   (chat baru memakai chat_sessions/chat_session_messages, migrasi P2).
--   Tabel legacy dibiarkan hidup di live apa adanya; policy P0/P0b tetap
--   berlaku untuknya. Jangan dibuat ulang dari file ini.
-- - Policy RLS per tabel: tetap di migrasi P0 (dan P2 untuk chat). File ini
--   hanya meng-enable RLS, supaya definisi policy tidak dobel dan hanyut.
-- - Kolom `updated_at` di orders/invoices: muncul sebagai opsional di
--   src/lib/types/order.ts tapi TIDAK PERNAH ditulis kode mana pun, jadi
--   tidak dibuat di sini. Bila live punya kolom itu, verify akan menunjukkannya.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- stores — 1 akun = 1 toko (aturan produk, Bab 5 rencana SaaS).
-- Kolom terbukti dari kode: id, owner_id, name, slug, description, whatsapp,
-- city, address, instagram, theme, logo_url, banner_url
-- (dashboard/settings: fullPayload + select '*'; storefront: select '*').
-- TERVERIFIKASI LIVE 2026-11-08: owner_id uuid + FK ke auth.users (ada
--   FK stores_owner_id_fkey); created_at ada; theme tanpa CHECK.
--   Kolom tambahan di bawah DITEMUKAN di live (verify bagian 2) dan
--   ditambahkan ke file ini supaya rekonstruksi akurat. Tabel sudah ada
--   di live, jadi CREATE IF NOT EXISTS di sini tidak mengubah live.
--   - payment_bank_name/payment_account_name/payment_account_number/
--     payment_qris_image_url MENDUPLIKASI bank_name/bank_account_name/
--     bank_account_number/qris_image_url (pasangan lama + baru) — jangan
--     hapus salah satunya sebelum kode dipastikan hanya memakai satu.
--   - user_id (uuid + FK stores_user_id_fkey) adalah kolom owner LEGACY;
--     kode saat ini memakai owner_id.
--   - origin_*/sender_*: alamat asal + pengirim untuk ongkir (RajaOngkir);
--     cod_enabled: apakah toko mengizinkan COD.
--   - CHECK live (bukan di file ini, sudah ada di live): stores_slug_format_check
--     (= migrasi P1) dan stores_origin_subdistrict_id_format_chk.
-- ---------------------------------------------------------------------------
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  whatsapp text,
  city text,
  address text,
  instagram text,
  theme text not null default 'default',
  logo_url text,
  banner_url text,
  payment_bank_name text,
  payment_account_name text,
  payment_account_number text,
  payment_qris_image_url text,
  origin_city_id text,
  origin_subdistrict_id text,
  sender_name text,
  sender_phone text,
  sender_address text,
  sender_postal_code text,
  origin_province text,
  origin_city text,
  origin_district text,
  origin_postal_code text,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  qris_image_url text,
  cod_enabled boolean,
  updated_at timestamptz,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- product_categories — kategori katalog (dibaca storefront).
-- Kolom terbukti dari kode: id, name (select id, name di storefront).
-- TERVERIFIKASI LIVE 2026-11-08: live punya store_id (FK
--   product_categories_store_id_fkey) + sort_order integer — kategori
--   ternyata per toko, bukan daftar global. Live TIDAK punya created_at;
--   kolom itu tetap ditulis di CREATE ini untuk instalasi baru (tidak
--   berpengaruh ke live karena tabel sudah ada).
-- ---------------------------------------------------------------------------
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores (id) on delete cascade,
  name text not null,
  sort_order integer,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- products — katalog toko.
-- Kolom terbukti dari kode: id, store_id, name, slug, price, stock,
-- description, available, images, badge, category_id, created_at
-- (select/insert/update di dashboard/products + storefront + checkout).
-- TERVERIFIKASI LIVE 2026-11-08: price numeric, stock integer,
--   images text[] (udt _text) — semua tebakan benar. Kolom tambahan
--   ditemukan di live: weight_gram (CHECK live products_weight_gram_check:
--   weight_gram > 0), allowed_couriers text[], updated_at.
--   Keunikan slug per toko SUDAH ada di live (products_store_id_slug_key)
--   — dibuat ulang di bawah lewat DO block berpenjaga untuk instalasi baru.
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  slug text not null,
  price numeric not null,
  stock integer not null default 0,
  description text,
  available boolean not null default true,
  images text[],
  badge text,
  category_id uuid references public.product_categories (id) on delete set null,
  weight_gram integer constraint products_weight_gram_check check (weight_gram > 0),
  allowed_couriers text[],
  updated_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- shipping_methods — metode pengiriman per toko.
-- Kolom terbukti dari kode: id, store_id, name, price, estimated_days,
-- is_active, created_at (checkout + dashboard/shipping).
-- NEEDS_LIVE_VERIFY:
--   - price: `numeric` (lihat catatan price di products).
--   - estimated_days: `text` (kode: string | null, mis. "1-2 hari").
-- ---------------------------------------------------------------------------
create table if not exists public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  price numeric not null default 0,
  estimated_days text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- orders — pesanan. Dibuat oleh checkout tamu lewat service_role.
-- Kolom terbukti dari kode: id, store_id, customer_name, customer_phone,
-- address, province, city, postal_code, notes, subtotal, shipping_cost,
-- total, status, payment_method, shipping_method_name, created_at
-- (checkout insert + dashboard/orders + confirm-payment + fulfillment).
-- Daftar status & metode diambil dari src/lib/types/order.ts dan
-- src/lib/actions/order-fulfillment.ts (ALLOWED_TRANSITIONS).
-- TERVERIFIKASI LIVE 2026-11-08: subtotal/shipping_cost/total numeric;
--   nilai status di data (CANCELLED/PAID/PENDING_PAYMENT/PROCESSING/SHIPPED)
--   semuanya masuk daftar CHECK. Kolom tambahan ditemukan di live dan
--   ditambahkan di bawah: alamat pelanggan lanjutan, bukti/jejak pembayaran,
--   dan kolom kurir/resi/pelacakan (pengiriman sudah lebih maju dari yang
--   terlihat di kode checkout — ada integrasi kurir + lacak resi).
--   CHECK live: orders_total_weight_gram_check (total_weight_gram >= 0).
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  address text not null,
  province text not null,
  city text not null,
  postal_code text not null,
  notes text,
  subtotal numeric not null,
  shipping_cost numeric not null default 0,
  total numeric not null,
  status text not null default 'PENDING_PAYMENT'
    check (status in ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED')),
  payment_method text not null
    check (payment_method in ('BANK_TRANSFER', 'QRIS', 'COD')),
  shipping_method_name text,
  updated_at timestamptz,
  customer_address text,
  payment_proof_url text,
  paid_at timestamptz,
  cancelled_at timestamptz,
  courier_code text,
  courier_service text,
  etd text,
  resi_number text,
  shipped_at timestamptz,
  shipping_status text,
  last_tracking_at timestamptz,
  tracking_summary text,
  customer_district text,
  customer_email text,
  shipping_courier_code text,
  shipping_courier_name text,
  shipping_service text,
  shipping_service_description text,
  shipping_etd text,
  total_weight_gram integer constraint orders_total_weight_gram_check check (total_weight_gram >= 0),
  payment_deadline_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- order_items — item per order.
-- Kolom terbukti dari kode: id, order_id, product_id, product_name, qty,
-- price, subtotal, notes (checkout insert + dashboard + fulfillment).
-- NEEDS_LIVE_VERIFY:
--   - price/subtotal: `numeric` (lihat catatan price).
--   - product_id nullable: restoreStock di order-fulfillment.ts melewati
--     item tanpa product_id (`if (!item.product_id) continue`), jadi
--     kolom ini nullable + ON DELETE SET NULL.
--   - created_at: tidak pernah di-select kode; tidak dibuat di sini.
-- ---------------------------------------------------------------------------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  qty integer not null check (qty > 0),
  price numeric not null,
  subtotal numeric not null,
  notes text
);

-- ---------------------------------------------------------------------------
-- invoices — tagihan per order. Satu invoice per order (dibuat checkout).
-- Kolom terbukti dari kode: id, order_id, invoice_number, payment_status,
-- payment_method, total, payment_proof_url, access_token, created_at.
-- Daftar payment_status disamakan dengan constraint hasil hotfix
-- 20261107_hotfix_invoice_status_check.sql.
-- TERVERIFIKASI LIVE 2026-11-08: total numeric; daftar payment_status
--   CHECK sama dengan hotfix (nilai di data: PAID, PENDING_PAYMENT).
--   Kolom tambahan ditemukan di live: jejak verifikasi bukti bayar
--   (diunggah/diverifikasi oleh siapa + kapan, catatan) + updated_at.
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  invoice_number text not null,
  payment_status text not null default 'PENDING_PAYMENT'
    check (payment_status in ('PENDING_PAYMENT', 'WAITING_VERIFICATION', 'PAID', 'FAILED', 'REFUNDED')),
  payment_method text
    check (payment_method in ('BANK_TRANSFER', 'QRIS', 'COD')),
  total numeric not null,
  payment_proof_url text,
  access_token uuid not null default gen_random_uuid(),
  updated_at timestamptz,
  payment_proof_uploaded_at timestamptz,
  payment_verified_at timestamptz,
  payment_verified_by uuid,
  payment_note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- shipments — resi per order. Satu shipment per order (aksi seller memakai
-- pola upsert: ada -> update, belum ada -> insert).
-- Kolom terbukti dari kode: id, order_id, courier, tracking_number,
-- status, shipped_at, created_at (order-fulfillment + dashboard).
-- NEEDS_LIVE_VERIFY:
--   - status: hanya 'SHIPPED' yang pernah DITULIS kode; live belum punya
--     baris shipments sama sekali (0 baris), jadi TIDAK diberi CHECK di sini.
--   - notes: kolom tambahan ditemukan di live (verify 2026-11-08).
-- ---------------------------------------------------------------------------
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  courier text not null,
  tracking_number text not null,
  status text not null default 'SHIPPED',
  shipped_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- chat_sessions + chat_session_messages — chat toko (model baru).
-- SUDAH dibuat migrasi P2; diulang di sini supaya file ini lengkap sebagai
-- rekonstruksi skema inti (IF NOT EXISTS, tidak mengubah yang sudah ada).
-- ---------------------------------------------------------------------------
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  buyer_name text not null,
  buyer_phone text,
  access_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.chat_session_messages (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  sender text not null check (sender in ('buyer', 'seller')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Index
-- ---------------------------------------------------------------------------
create index if not exists stores_owner_idx
  on public.stores (owner_id);
-- stores_slug_key dibuat di bawah (DO block berpenjaga): bila live sudah
-- punya slug ganda, index tidak dibuat dan NOTICE dicetak, bukan error.
create index if not exists products_store_idx
  on public.products (store_id, created_at desc);
create index if not exists shipping_methods_store_idx
  on public.shipping_methods (store_id);
create index if not exists orders_store_created_idx
  on public.orders (store_id, created_at desc);
create index if not exists order_items_order_idx
  on public.order_items (order_id);
create unique index if not exists invoices_invoice_number_key
  on public.invoices (invoice_number);
create index if not exists invoices_order_idx
  on public.invoices (order_id);
create index if not exists shipments_order_idx
  on public.shipments (order_id);
create index if not exists chat_sessions_store_idx
  on public.chat_sessions (store_id, last_message_at desc);
create index if not exists chat_session_messages_session_idx
  on public.chat_session_messages (session_id, created_at);

-- ---------------------------------------------------------------------------
-- Keunikan slug toko: kode mengandalkan 23505 saat slug dipakai toko lain
-- (dashboard/settings), jadi live diasumsikan sudah unik. Bila ternyata
-- ada slug ganda, index TIDAK dibuat dan NOTICE dicetak.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'stores_slug_key'
  ) then
    raise notice 'Unique index stores_slug_key sudah ada, dilewati.';
  elsif exists (
    select slug from public.stores group by slug having count(*) > 1
  ) then
    raise notice 'Ada slug toko ganda; unique index TIDAK dibuat. Perbaiki data lalu jalankan ulang.';
  else
    create unique index stores_slug_key on public.stores (slug);
    raise notice 'Unique index stores_slug_key dibuat.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Aturan 1 akun = 1 toko, ditegakkan di database.
-- Kode selama ini hanya berasumsi (`.single()` di dashboard layout +
-- settings): bila live sudah terlanjur punya 1 akun dengan 2 toko,
-- index TIDAK dibuat dan NOTICE dicetak — perbaiki datanya dulu secara
-- manual, lalu jalankan ulang file ini.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'stores_owner_id_key'
  ) then
    raise notice 'Unique index stores_owner_id_key sudah ada, dilewati.';
  elsif exists (
    select owner_id from public.stores group by owner_id having count(*) > 1
  ) then
    raise notice 'Ada owner_id dengan >1 toko; unique index TIDAK dibuat. Perbaiki data lalu jalankan ulang.';
  else
    create unique index stores_owner_id_key on public.stores (owner_id);
    raise notice 'Unique index stores_owner_id_key dibuat (1 akun = 1 toko).';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Satu invoice per order + satu shipment per order (invarian yang dipakai
-- checkout dan aksi input-resi). Pola yang sama: bila ada duplikat di live,
-- index tidak dibuat dan NOTICE dicetak.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'invoices_order_id_key'
  ) then
    raise notice 'Unique index invoices_order_id_key sudah ada, dilewati.';
  elsif exists (
    select order_id from public.invoices group by order_id having count(*) > 1
  ) then
    raise notice 'Ada order_id dengan >1 invoice; unique index TIDAK dibuat. Perbaiki data lalu jalankan ulang.';
  else
    create unique index invoices_order_id_key on public.invoices (order_id);
    raise notice 'Unique index invoices_order_id_key dibuat (1 invoice per order).';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'shipments_order_id_key'
  ) then
    raise notice 'Unique index shipments_order_id_key sudah ada, dilewati.';
  elsif exists (
    select order_id from public.shipments group by order_id having count(*) > 1
  ) then
    raise notice 'Ada order_id dengan >1 shipment; unique index TIDAK dibuat. Perbaiki data lalu jalankan ulang.';
  else
    create unique index shipments_order_id_key on public.shipments (order_id);
    raise notice 'Unique index shipments_order_id_key dibuat (1 shipment per order).';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Keunikan slug produk per toko: SUDAH ada di live
-- (products_store_id_slug_key) — DO block berpenjaga ini membuatnya
-- untuk instalasi baru, dan melewatinya bila sudah ada / ada duplikat.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'products_store_id_slug_key'
  ) then
    raise notice 'Unique index products_store_id_slug_key sudah ada, dilewati.';
  elsif exists (
    select store_id, slug from public.products group by store_id, slug having count(*) > 1
  ) then
    raise notice 'Ada slug produk ganda dalam satu toko; unique index TIDAK dibuat. Perbaiki data lalu jalankan ulang.';
  else
    create unique index products_store_id_slug_key on public.products (store_id, slug);
    raise notice 'Unique index products_store_id_slug_key dibuat (slug produk unik per toko).';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RLS aktif di semua tabel inti. Policy-nya TETAP di migrasi P0 (dan P2
-- untuk chat) — file ini tidak mendefinisikan ulang policy supaya tidak
-- ada dua sumber kebenaran.
-- ---------------------------------------------------------------------------
alter table public.stores enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.shipping_methods enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.invoices enable row level security;
alter table public.shipments enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_session_messages enable row level security;
