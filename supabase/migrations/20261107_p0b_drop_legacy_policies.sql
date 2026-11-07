-- Migrasi P0b (2026-11-07): menghapus policy RLS LAMA yang terlalu longgar.
--
-- Latar: dump pg_policies 2026-11-07 menunjukkan policy ketat dari migrasi
-- P0 sudah terpasang, TETAPI policy lama yang longgar masih ada berdampingan.
-- Policy RLS bersifat ATAU (permissive) — satu policy longgar menetralkan
-- semua policy ketat di tabel yang sama. File ini menghapus policy lama itu.
--
-- Jalankan SETELAH migrasi P0. Aman dijalankan berulang (if exists).
-- Yang SENGAJA DIPERTAHANKAN: policy *_owner_* dan *_public_read dari P0,
-- baca publik untuk katalog (stores/products/shipping_methods/
-- product_categories/couriers), tampil publik foto produk & gambar QRIS.

-- 1. invoices — siapa pun bisa insert/update/baca invoice (KRITIS) ------------
drop policy if exists "anyone insert invoice" on public.invoices;
drop policy if exists "anyone update invoice" on public.invoices;
drop policy if exists "public read invoices" on public.invoices;

-- 2. orders — baca publik = data pribadi customer bocor; insert publik --------
--    tidak lagi dipakai karena checkout berjalan lewat service_role.
drop policy if exists "Anyone can create orders" on public.orders;
drop policy if exists "anyone insert order" on public.orders;
drop policy if exists "public can insert orders" on public.orders;
drop policy if exists "public can read orders for tracking" on public.orders;
drop policy if exists "seller read own orders" on public.orders;
drop policy if exists "seller update own orders" on public.orders;
drop policy if exists "store owner can read own orders" on public.orders;
drop policy if exists "store owner can update own orders" on public.orders;

-- 3. order_items — pola yang sama dengan orders --------------------------------
drop policy if exists "Anyone can create order items" on public.order_items;
drop policy if exists "anyone insert order items" on public.order_items;
drop policy if exists "public can insert order items" on public.order_items;
drop policy if exists "public can read order items for tracking" on public.order_items;
drop policy if exists "store owner can read own order items" on public.order_items;
drop policy if exists "order_items_owner_update" on public.order_items;

-- 4. Chat lama (chats + chat_messages) — baca/tulis publik ----------------------
drop policy if exists "anyone insert chat" on public.chats;
drop policy if exists "public read chats" on public.chats;
drop policy if exists "anyone insert message" on public.chat_messages;
drop policy if exists "public read messages" on public.chat_messages;

-- 5. Policy "seller manage own ..." ber-role {public} dengan cmd ALL ----------
--    (berlaku untuk SEMUA orang termasuk tamu; versi owner dari P0 sudah ada)
drop policy if exists "seller manage own stores" on public.stores;
drop policy if exists "seller manage own products" on public.products;
drop policy if exists "seller manage own shipping" on public.shipping_methods;
drop policy if exists "seller manage own shipments" on public.shipments;
drop policy if exists "seller manage own categories" on public.product_categories;

-- 6. shipments — nomor resi bisa dibaca publik ----------------------------------
drop policy if exists "public read shipments" on public.shipments;

-- 7. Storage: bukti transfer (payment-proofs) — semua akses publik dicabut -----
--    Bucket sudah privat; upload & baca berjalan lewat service_role (server),
--    dashboard membaca lewat signed URL (P1). Tanpa policy, hanya
--    service_role yang bisa mengakses objek di bucket ini.
drop policy if exists "Allow public selects payment proofs" on storage.objects;
drop policy if exists "Allow public updates payment proofs" on storage.objects;
drop policy if exists "Allow public uploads payment proofs" on storage.objects;
drop policy if exists "Public can view payment proofs" on storage.objects;
drop policy if exists "Public read payment proofs" on storage.objects;
drop policy if exists "Public upload payment proofs" on storage.objects;
drop policy if exists "Public can upload invoice proofs images" on storage.objects;
drop policy if exists "Public can update invoice proofs images" on storage.objects;

-- 8. Storage: foto produk — tamu tidak boleh upload/menimpa ---------------------
--    (baca publik dipertahankan: bucket product-images memang publik)
drop policy if exists "Public can upload product images" on storage.objects;
drop policy if exists "Public can update product images" on storage.objects;
