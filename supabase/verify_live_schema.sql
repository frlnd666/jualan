-- ============================================================================
-- Fase 0 — Verifikasi skema live (2026-11-08, revisi 2). READ-ONLY.
--
-- CARA PAKAI: jalankan SELURUH file ini di Supabase SQL Editor (proyek
-- yang dipakai aplikasi CUAN/jualan). File ini HANYA membaca
-- (SELECT ke information_schema / pg_catalog) — tidak mengubah apa pun.
--
-- PENTING (revisi 2): file ini sekarang SATU query tunggal (UNION ALL)
-- supaya hasilnya muncul sebagai SATU tabel. SQL Editor Supabase hanya
-- menampilkan hasil query TERAKHIR — versi sebelumnya berisi banyak
-- SELECT terpisah sehingga hanya baris 7g yang terlihat.
--
-- TUJUAN: membandingkan skema LIVE dengan rekonstruksi di
-- supabase/migrations/20261108_f0_core_schema.sql (+ f0_stock_rpc.sql dan
-- f0_roles.sql). Bila ada perbedaan, yang benar adalah LIVE: perbaiki file
-- migrasi di repo, jangan ubah live mengikuti file.
--
-- BACA HASIL: satu tabel, kolom pemeriksaan + hasil. Kerjakan semua baris
-- berlabel PERLU TINDAKAN sebelum menjalankan migrasi Fase 0. Baris INFO
-- hanya informasi — kirimkan ke asisten bila nilainya di luar dugaan.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabel inti yang ada di live + perkiraan jumlah baris
--    (tabel yang TIDAK muncul di sini berarti BELUM ADA di live)
-- ---------------------------------------------------------------------------
select '1 tabel ' || t.table_name as pemeriksaan,
  'perkiraan baris: ' || coalesce(s.n_live_tup, 0)::text as hasil
from information_schema.tables t
left join pg_stat_user_tables s
  on s.schemaname = 'public' and s.relname = t.table_name
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
  and t.table_name in (
    'stores', 'product_categories', 'products', 'shipping_methods',
    'orders', 'order_items', 'invoices', 'shipments',
    'chat_sessions', 'chat_session_messages',
    'chats', 'chat_messages', 'profiles'
  )

union all

-- ---------------------------------------------------------------------------
-- 2. Kolom tiap tabel inti (nama + tipe), satu baris per tabel.
--    Perhatikan khususnya: products.images (text[] vs jsonb),
--    kolom uang (numeric vs integer), dan kolom yang ada di live tapi
--    tidak ada di file migrasi — kolom seperti itu JANGAN dihapus.
-- ---------------------------------------------------------------------------
select '2 kolom ' || table_name as pemeriksaan,
  string_agg(
    column_name || ' ' ||
    case when data_type = 'ARRAY' then replace(udt_name, '_', '') || '[]'
         else data_type end,
    ', ' order by ordinal_position
  ) as hasil
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'stores', 'product_categories', 'products', 'shipping_methods',
    'orders', 'order_items', 'invoices', 'shipments',
    'chat_sessions', 'chat_session_messages', 'profiles'
  )
group by table_name

union all

-- ---------------------------------------------------------------------------
-- 3. Constraint tiap tabel inti (PK / unique / check / FK), satu baris
--    per tabel.
-- ---------------------------------------------------------------------------
select '3 constraint ' || table_name as pemeriksaan,
  string_agg(constraint_type || ':' || constraint_name, ', '
    order by constraint_type, constraint_name) as hasil
from information_schema.table_constraints
where table_schema = 'public'
  and table_name in (
    'stores', 'product_categories', 'products', 'shipping_methods',
    'orders', 'order_items', 'invoices', 'shipments',
    'chat_sessions', 'chat_session_messages', 'profiles'
  )
group by table_name

union all

-- ---------------------------------------------------------------------------
-- 4. Isi CHECK constraint (definisi lengkap — untuk membandingkan daftar
--    nilai status yang diizinkan dengan yang ditulis kode aplikasi)
-- ---------------------------------------------------------------------------
select '4 check ' || conrelid::regclass::text as pemeriksaan,
  string_agg(conname || ' = ' || pg_get_constraintdef(oid), ' | '
    order by conname) as hasil
from pg_constraint
where connamespace = 'public'::regnamespace
  and contype = 'c'
  and conrelid::regclass::text in (
    'stores', 'product_categories', 'products', 'shipping_methods',
    'orders', 'order_items', 'invoices', 'shipments',
    'chat_sessions', 'chat_session_messages', 'profiles'
  )
group by conrelid::regclass::text

union all

-- ---------------------------------------------------------------------------
-- 5. Index tiap tabel inti, satu baris per tabel.
-- ---------------------------------------------------------------------------
select '5 index ' || tablename as pemeriksaan,
  string_agg(indexname, ', ' order by indexname) as hasil
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'stores', 'product_categories', 'products', 'shipping_methods',
    'orders', 'order_items', 'invoices', 'shipments',
    'chat_sessions', 'chat_session_messages', 'profiles'
  )
group by tablename

union all

-- ---------------------------------------------------------------------------
-- 6. RLS aktif atau tidak + daftar policy, satu baris per tabel.
-- ---------------------------------------------------------------------------
select '6 rls+policy ' || c.relname as pemeriksaan,
  'rls=' || case when c.relrowsecurity then 'aktif' else 'MATI' end
  || ' | policy: ' || coalesce(
      (select string_agg(policyname, ', ' order by policyname)
       from pg_policies p
       where p.schemaname = 'public' and p.tablename = c.relname),
      '(tidak ada)') as hasil
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'stores', 'product_categories', 'products', 'shipping_methods',
    'orders', 'order_items', 'invoices', 'shipments',
    'chat_sessions', 'chat_session_messages',
    'chats', 'chat_messages', 'profiles'
  )

union all

-- ---------------------------------------------------------------------------
-- 7a. Kolom kunci yang ditambahkan migrasi P0/P2 sudah ada?
-- ---------------------------------------------------------------------------
select '7a invoices.access_token' as pemeriksaan,
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'invoices'
      and column_name = 'access_token'
  ) then 'OK' else 'PERLU TINDAKAN: jalankan migrasi P0 dulu' end as hasil
union all
select '7a shipments.shipped_at',
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shipments'
      and column_name = 'shipped_at'
  ) then 'OK' else 'PERLU TINDAKAN: jalankan migrasi P2 dulu' end
union all
select '7a stores.city/address/instagram',
  case when (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'stores'
      and column_name in ('city', 'address', 'instagram')
  ) = 3 then 'OK' else 'PERLU TINDAKAN: jalankan migrasi P2 dulu' end

union all

-- ---------------------------------------------------------------------------
-- 7b. Keunikan yang diasumsikan kode (slug, 1 akun = 1 toko, dsb.)
-- ---------------------------------------------------------------------------
select '7b stores.slug unik' as pemeriksaan,
  case when exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'stores'
      and indexdef ilike '%unique%' and indexdef ilike '%(slug)%'
  ) then 'OK' else 'PERLU TINDAKAN: belum ada unique index slug (f0 akan membuatnya bila tidak ada slug ganda)' end as hasil
union all
select '7b stores.owner_id unik (1 akun = 1 toko)',
  case when exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'stores'
      and indexdef ilike '%unique%' and indexdef ilike '%(owner_id)%'
  ) then 'OK' else 'PERLU TINDAKAN: belum ditegakkan di DB (f0 akan membuatnya bila tidak ada owner ganda)' end
union all
select '7b invoices.invoice_number unik',
  case when exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'invoices'
      and indexdef ilike '%unique%' and indexdef ilike '%(invoice_number)%'
  ) then 'OK' else 'PERLU TINDAKAN: jalankan migrasi P0 dulu' end

union all

-- ---------------------------------------------------------------------------
-- 7c. Duplikat yang akan menggagalkan index unik Fase 0 (harus 0 semua)
-- ---------------------------------------------------------------------------
select '7c duplikat stores.slug: ' || count(*) as pemeriksaan,
  case when count(*) = 0 then 'OK'
    else 'PERLU TINDAKAN: ada slug ganda, perbaiki dulu' end as hasil
from (select slug from public.stores group by slug having count(*) > 1) d
union all
select '7c duplikat stores.owner_id: ' || count(*),
  case when count(*) = 0 then 'OK'
    else 'PERLU TINDAKAN: ada akun dengan >1 toko, perbaiki dulu' end
from (select owner_id from public.stores group by owner_id having count(*) > 1) d
union all
select '7c duplikat invoices.order_id: ' || count(*),
  case when count(*) = 0 then 'OK'
    else 'PERLU TINDAKAN: ada order dengan >1 invoice, perbaiki dulu' end
from (select order_id from public.invoices group by order_id having count(*) > 1) d
union all
select '7c duplikat shipments.order_id: ' || count(*),
  case when count(*) = 0 then 'OK'
    else 'PERLU TINDAKAN: ada order dengan >1 shipment, perbaiki dulu' end
from (select order_id from public.shipments group by order_id having count(*) > 1) d

union all

-- ---------------------------------------------------------------------------
-- 7d. Nilai status yang ADA di data (bandingkan dengan daftar CHECK di f0)
-- ---------------------------------------------------------------------------
select '7d orders.status distinct: ' || coalesce(string_agg(distinct status, ', '), '(kosong)') as pemeriksaan,
  'INFO: bila ada nilai di luar PENDING_PAYMENT/PAID/PROCESSING/SHIPPED/COMPLETED/CANCELLED, beri tahu sebelum menjalankan f0' as hasil
from public.orders
union all
select '7d invoices.payment_status distinct: ' || coalesce(string_agg(distinct payment_status, ', '), '(kosong)'),
  'INFO: bila ada nilai di luar PENDING_PAYMENT/WAITING_VERIFICATION/PAID/FAILED/REFUNDED, beri tahu sebelum menjalankan f0'
from public.invoices
union all
select '7d shipments.status distinct: ' || coalesce(string_agg(distinct status, ', '), '(kosong)'),
  'INFO: nilai selain SHIPPED dicatat di sini untuk rekonstruksi f0'
from public.shipments

union all

-- ---------------------------------------------------------------------------
-- 7e. Tipe kolom yang ditebak di f0 (pastikan sama dengan file migrasi)
-- ---------------------------------------------------------------------------
select '7e products.images udt: ' || coalesce(udt_name, '(kolom tidak ada)') as pemeriksaan,
  'INFO: f0 memakai text[] — bila live jsonb, perbaiki f0' as hasil
from information_schema.columns
where table_schema = 'public' and table_name = 'products' and column_name = 'images'
union all
select '7e products.price data_type: ' || coalesce(data_type, '(kolom tidak ada)'),
  'INFO: f0 memakai numeric — bila live integer, perbaiki f0'
from information_schema.columns
where table_schema = 'public' and table_name = 'products' and column_name = 'price'
union all
select '7e products.stock data_type: ' || coalesce(data_type, '(kolom tidak ada)'),
  'INFO: f0 memakai integer'
from information_schema.columns
where table_schema = 'public' and table_name = 'products' and column_name = 'stock'
union all
select '7e orders.total data_type: ' || coalesce(data_type, '(kolom tidak ada)'),
  'INFO: f0 memakai numeric — bila live integer, perbaiki f0'
from information_schema.columns
where table_schema = 'public' and table_name = 'orders' and column_name = 'total'

union all

-- ---------------------------------------------------------------------------
-- 7f. Fungsi RPC Fase 0 + helper peran (sebelum migrasi: tidak ada = wajar)
-- ---------------------------------------------------------------------------
select '7f fungsi decrement_stock' as pemeriksaan,
  case when exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'decrement_stock'
  ) then 'OK: sudah ada' else 'INFO: belum ada (dibuat f0_stock_rpc.sql)' end as hasil
union all
select '7f fungsi increment_stock',
  case when exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'increment_stock'
  ) then 'OK: sudah ada' else 'INFO: belum ada (dibuat f0_stock_rpc.sql)' end
union all
select '7f tabel profiles',
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then 'OK: sudah ada' else 'INFO: belum ada (dibuat f0_roles.sql)' end
union all
select '7f fungsi is_admin',
  case when exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_admin'
  ) then 'OK: sudah ada' else 'INFO: belum ada (dibuat f0_roles.sql)' end

union all

-- ---------------------------------------------------------------------------
-- 7g. Policy lama yang longgar masih ada? (harus 0 — P0b seharusnya sudah
--      menghapusnya; bila masih ada, JANGAN lanjut sebelum dibersihkan)
-- ---------------------------------------------------------------------------
select '7g policy longgar tersisa: ' || count(*) as pemeriksaan,
  case when count(*) = 0 then 'OK'
    else 'PERLU TINDAKAN: masih ada policy longgar, jalankan migrasi P0b' end as hasil
from pg_policies
where schemaname = 'public'
  and policyname in (
    'anyone insert invoice', 'anyone update invoice', 'public read invoices',
    'Anyone can create orders', 'anyone insert order',
    'public can insert orders', 'public can read orders for tracking',
    'Anyone can create order items', 'anyone insert order items',
    'public can insert order items', 'public can read order items for tracking',
    'anyone insert chat', 'public read chats',
    'anyone insert message', 'public read messages',
    'seller manage own stores', 'seller manage own products',
    'seller manage own shipping', 'seller manage own shipments',
    'seller manage own categories', 'public read shipments'
  );
