-- ============================================================================
-- P0 Security — frlnd666/jualan (UMKM Storefront)
-- ============================================================================
-- URUTAN AKTIVASI (penting, jangan dibalik):
--   1. Set env SUPABASE_SERVICE_ROLE_KEY di Vercel + .env.local
--      (Supabase Dashboard > Project Settings > API > service_role).
--   2. Deploy kode branch fix/p0-security (atau yang sudah di-merge).
--   3. BARU jalankan file ini di Supabase SQL Editor.
-- Bila langkah 3 didahulukan, halaman invoice/track publik & upload bukti
-- transfer akan gagal membaca invoices sampai env + kode baru aktif, karena
-- migrasi ini menutup akses anon ke tabel order/invoice.
--
-- CATATAN: repo ini sebelumnya tidak menyimpan skema database sama sekali.
-- Bagian A hanya MENAMBAH kolom yang hilang dan mengaktifkan RLS + policy;
-- tidak ada `create table` rekonstruksi di sini. Periksa nama tabel/kolom
-- terhadap database live kamu sebelum menjalankan (harusnya sama persis
-- dengan yang dipakai kode aplikasi: stores, products, shipping_methods,
-- orders, order_items, invoices, shipments, chats).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. access_token untuk invoice (gerbang halaman publik)
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

alter table public.invoices
  add column if not exists access_token uuid;

update public.invoices
set access_token = gen_random_uuid()
where access_token is null;

alter table public.invoices
  alter column access_token set default gen_random_uuid();

create unique index if not exists invoices_invoice_number_key
  on public.invoices (invoice_number);

-- ---------------------------------------------------------------------------
-- B. Aktifkan RLS di semua tabel aplikasi
-- ---------------------------------------------------------------------------
alter table public.stores           enable row level security;
alter table public.products         enable row level security;
alter table public.shipping_methods enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.invoices         enable row level security;
alter table public.shipments        enable row level security;
alter table public.chats            enable row level security;

-- Helper konsep (ditulis inline di policy di bawah):
--   owns_store(store_id)  := exists(select 1 from stores s
--                              where s.id = store_id and s.owner_id = auth.uid())
--   owns_order(order_id)  := exists(select 1 from orders o join stores s
--                                on s.id = o.store_id
--                              where o.id = order_id and s.owner_id = auth.uid())

-- ---------------------------------------------------------------------------
-- C. stores — katalog publik boleh dibaca siapa saja; tulis hanya pemilik
-- ---------------------------------------------------------------------------
drop policy if exists "stores_public_read"   on public.stores;
drop policy if exists "stores_owner_insert"  on public.stores;
drop policy if exists "stores_owner_update"  on public.stores;
drop policy if exists "stores_owner_delete"  on public.stores;

create policy "stores_public_read" on public.stores
  for select using (true);

create policy "stores_owner_insert" on public.stores
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "stores_owner_update" on public.stores
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "stores_owner_delete" on public.stores
  for delete to authenticated
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- D. products — katalog publik; tulis hanya pemilik toko
-- ---------------------------------------------------------------------------
drop policy if exists "products_public_read"  on public.products;
drop policy if exists "products_owner_insert" on public.products;
drop policy if exists "products_owner_update" on public.products;
drop policy if exists "products_owner_delete" on public.products;

create policy "products_public_read" on public.products
  for select using (true);

create policy "products_owner_insert" on public.products
  for insert to authenticated
  with check (exists (
    select 1 from public.stores s
    where s.id = store_id and s.owner_id = auth.uid()
  ));

create policy "products_owner_update" on public.products
  for update to authenticated
  using (exists (
    select 1 from public.stores s
    where s.id = store_id and s.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.stores s
    where s.id = store_id and s.owner_id = auth.uid()
  ));

create policy "products_owner_delete" on public.products
  for delete to authenticated
  using (exists (
    select 1 from public.stores s
    where s.id = store_id and s.owner_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- E. shipping_methods — dibaca publik (storefront & checkout); tulis pemilik
-- ---------------------------------------------------------------------------
drop policy if exists "shipping_public_read"  on public.shipping_methods;
drop policy if exists "shipping_owner_insert" on public.shipping_methods;
drop policy if exists "shipping_owner_update" on public.shipping_methods;
drop policy if exists "shipping_owner_delete" on public.shipping_methods;

create policy "shipping_public_read" on public.shipping_methods
  for select using (true);

create policy "shipping_owner_insert" on public.shipping_methods
  for insert to authenticated
  with check (exists (
    select 1 from public.stores s
    where s.id = store_id and s.owner_id = auth.uid()
  ));

create policy "shipping_owner_update" on public.shipping_methods
  for update to authenticated
  using (exists (
    select 1 from public.stores s
    where s.id = store_id and s.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.stores s
    where s.id = store_id and s.owner_id = auth.uid()
  ));

create policy "shipping_owner_delete" on public.shipping_methods
  for delete to authenticated
  using (exists (
    select 1 from public.stores s
    where s.id = store_id and s.owner_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- F. orders — DATA PRIBADI. Tidak ada akses anon sama sekali.
--    Checkout tamu & halaman publik berjalan lewat service_role (server),
--    yang melewati RLS secara desain. Yang tersisa di sini hanya pemilik.
-- ---------------------------------------------------------------------------
drop policy if exists "orders_owner_select" on public.orders;
drop policy if exists "orders_owner_update" on public.orders;
drop policy if exists "orders_owner_delete" on public.orders;

create policy "orders_owner_select" on public.orders
  for select to authenticated
  using (exists (
    select 1 from public.stores s
    where s.id = store_id and s.owner_id = auth.uid()
  ));

create policy "orders_owner_update" on public.orders
  for update to authenticated
  using (exists (
    select 1 from public.stores s
    where s.id = store_id and s.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.stores s
    where s.id = store_id and s.owner_id = auth.uid()
  ));

create policy "orders_owner_delete" on public.orders
  for delete to authenticated
  using (exists (
    select 1 from public.stores s
    where s.id = store_id and s.owner_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- G. order_items — mengikuti kepemilikan order induk
-- ---------------------------------------------------------------------------
drop policy if exists "order_items_owner_select" on public.order_items;
drop policy if exists "order_items_owner_delete" on public.order_items;

create policy "order_items_owner_select" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    join public.stores s on s.id = o.store_id
    where o.id = order_id and s.owner_id = auth.uid()
  ));

create policy "order_items_owner_delete" on public.order_items
  for delete to authenticated
  using (exists (
    select 1 from public.orders o
    join public.stores s on s.id = o.store_id
    where o.id = order_id and s.owner_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- H. invoices — mengikuti kepemilikan order induk; update hanya pemilik
--    (dipakai confirmPayment dengan sesi login owner).
-- ---------------------------------------------------------------------------
drop policy if exists "invoices_owner_select" on public.invoices;
drop policy if exists "invoices_owner_update" on public.invoices;

create policy "invoices_owner_select" on public.invoices
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    join public.stores s on s.id = o.store_id
    where o.id = order_id and s.owner_id = auth.uid()
  ));

create policy "invoices_owner_update" on public.invoices
  for update to authenticated
  using (exists (
    select 1 from public.orders o
    join public.stores s on s.id = o.store_id
    where o.id = order_id and s.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.orders o
    join public.stores s on s.id = o.store_id
    where o.id = order_id and s.owner_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- I. shipments & chats — khusus pemilik toko dari order terkait
-- ---------------------------------------------------------------------------
drop policy if exists "shipments_owner_all" on public.shipments;
drop policy if exists "chats_owner_select"  on public.chats;
drop policy if exists "chats_owner_insert"  on public.chats;

create policy "shipments_owner_all" on public.shipments
  for all to authenticated
  using (exists (
    select 1 from public.orders o
    join public.stores s on s.id = o.store_id
    where o.id = order_id and s.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.orders o
    join public.stores s on s.id = o.store_id
    where o.id = order_id and s.owner_id = auth.uid()
  ));

create policy "chats_owner_select" on public.chats
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    join public.stores s on s.id = o.store_id
    where o.id = order_id and s.owner_id = auth.uid()
  ));

create policy "chats_owner_insert" on public.chats
  for insert to authenticated
  with check (exists (
    select 1 from public.orders o
    join public.stores s on s.id = o.store_id
    where o.id = order_id and s.owner_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- J. Storage: bucket payment-proofs dibuat PRIVAT.
--    Upload & baca untuk customer berjalan lewat server (service_role).
--    Dashboard owner membaca lewat URL tersimpan di invoices.payment_proof_url
--    — setelah bucket privat, URL publik lama berhenti bekerja; langkah
--    lanjutan (P1) adalah signed URL di sisi dashboard. product-images
--    tetap publik-baca (foto katalog), tulis hanya user login.
-- ---------------------------------------------------------------------------
update storage.buckets set public = false where id = 'payment-proofs';

drop policy if exists "payment_proofs_no_anon_read" on storage.objects;
-- Tidak membuat policy select/insert untuk anon/authenticated di bucket ini:
-- tanpa policy, hanya service_role yang bisa mengakses objeknya.

drop policy if exists "product_images_public_read"  on storage.objects;
drop policy if exists "product_images_auth_insert"  on storage.objects;
drop policy if exists "product_images_auth_update"  on storage.objects;

create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'product-images');

create policy "product_images_auth_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images');

create policy "product_images_auth_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

-- ============================================================================
-- CATATAN ATOMISITAS STOK (untuk langkah berikutnya):
-- Checkout saat ini mengurangi stok dari kode aplikasi dengan optimistic
-- lock (update ... where stock = nilai_lama) + rollback manual. Untuk
-- jaminan atomik penuh di bawah konkurensi tinggi, bungkus pembuatan order
-- dalam satu fungsi Postgres (RPC) bertransaksi dan panggil dari
-- createOrderAction. Skema fungsi itu sengaja tidak dipaksakan di migrasi
-- ini karena bentuk tabel live harus diverifikasi dulu.
-- ============================================================================
