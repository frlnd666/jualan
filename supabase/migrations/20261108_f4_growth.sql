-- ============================================================================
-- Fase 4 — Pertumbuhan (2026-11-09).
--
-- Isi:
--   1. flash_sales — harga promo per produk + jadwal (mulai/selesai).
--      Satu flash sale AKTIF per produk (partial unique index).
--      Harga promo dipakai di storefront, halaman produk, DAN checkout
--      (server-side — lihat createOrderAction); harga normal berlaku
--      lagi begitu jadwal berakhir.
--   2. store_banners — banner marketing toko (teks/gambar, maks 1 slide
--      AKTIF per toko). Banner milik toko Silver/Gold; toko Free
--      menampilkan slide iklan afiliasi platform (lihat komponen
--      AffiliateAdSlide) — bukan banner sendiri.
--   3. audit_log — jejak aksi penting (ubah tier/status langganan,
--      bekukan toko, tambah/hapus staff, verifikasi pembayaran, ubah
--      harga). Tulis hanya lewat service_role; baca hanya admin platform.
--
-- CARA PAKAI: jalankan SETELAH seluruh migrasi Fase 0–3 di Supabase SQL
-- Editor. Aman dijalankan berulang (IF NOT EXISTS / CREATE OR REPLACE /
-- DROP POLICY IF EXISTS). Tidak mengubah data yang sudah ada.
--
-- PERILAKU SEBELUM MIGRASI: flash sale + banner + audit log tidak aktif
-- (kode memakai fallback: harga normal, tanpa banner, log dilewati).
-- Analitik + export tidak butuh tabel baru (pakai orders/order_items/
-- invoices yang sudah ada) dan tetap jalan sebelum migrasi.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. flash_sales — satu baris per promo produk.
--    promo_price HARUS lebih kecil dari harga produk (dicek server action,
--    bukan CHECK di sini karena harga produk bisa berubah).
--    starts_at/ends_at wajib; is_active = saklar manual pemilik.
-- ---------------------------------------------------------------------------
create table if not exists public.flash_sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  promo_price numeric not null check (promo_price > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists flash_sales_store_idx
  on public.flash_sales (store_id, created_at desc);

create index if not exists flash_sales_product_idx
  on public.flash_sales (product_id, ends_at desc);

-- Satu flash sale AKTIF per produk — promo kedua baru boleh dibuat
-- setelah yang lama dimatikan (is_active = false) atau dihapus.
create unique index if not exists flash_sales_product_active_idx
  on public.flash_sales (product_id) where is_active;

alter table public.flash_sales enable row level security;

-- Hanya pemilik toko yang boleh mengelola flash sale tokonya.
-- Staff TIDAK diberi akses (flash sale = keputusan harga pemilik).
drop policy if exists flash_sales_owner_all on public.flash_sales;
create policy flash_sales_owner_all on public.flash_sales
  for all to authenticated
  using (
    exists (
      select 1 from public.stores s
       where s.id = flash_sales.store_id
         and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.stores s
       where s.id = flash_sales.store_id
         and s.owner_id = auth.uid()
    )
  );

-- Publik (anon + pembeli) hanya boleh membaca flash sale yang sedang
-- AKTIF + di dalam jadwal — hanya info promo, tanpa data internal.
-- Dipakai storefront, halaman produk, dan halaman checkout.
drop policy if exists flash_sales_public_active on public.flash_sales;
create policy flash_sales_public_active on public.flash_sales
  for select to anon, authenticated
  using (
    is_active
    and starts_at <= now()
    and ends_at >= now()
  );

-- ---------------------------------------------------------------------------
-- 2. store_banners — banner marketing toko (maks 1 slide AKTIF).
--    title = teks banner; image_url opsional; link_url opsional
--    (tautan eksternal / halaman toko sendiri).
-- ---------------------------------------------------------------------------
create table if not exists public.store_banners (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  title text not null,
  image_url text,
  link_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_banners_store_idx
  on public.store_banners (store_id, created_at desc);

-- Satu banner AKTIF per toko — banner kedua baru boleh dibuat setelah
-- yang lama dimatikan atau dihapus.
create unique index if not exists store_banners_store_active_idx
  on public.store_banners (store_id) where is_active;

alter table public.store_banners enable row level security;

-- Hanya pemilik toko yang boleh mengelola banner tokonya.
drop policy if exists store_banners_owner_all on public.store_banners;
create policy store_banners_owner_all on public.store_banners
  for all to authenticated
  using (
    exists (
      select 1 from public.stores s
       where s.id = store_banners.store_id
         and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.stores s
       where s.id = store_banners.store_id
         and s.owner_id = auth.uid()
    )
  );

-- Publik hanya boleh membaca banner AKTIF (untuk storefront).
drop policy if exists store_banners_public_active on public.store_banners;
create policy store_banners_public_active on public.store_banners
  for select to anon, authenticated
  using (is_active);

-- ---------------------------------------------------------------------------
-- 3. audit_log — jejak aksi penting platform.
--    action: subscription_verified | subscription_rejected |
--    subscription_cancelled | store_suspended | store_unsuspended |
--    staff_added | staff_removed | payment_confirmed | price_changed.
--    actor_role: 'admin' | 'seller' | 'staff' | 'system'.
--    Tulis HANYA lewat service_role (server action / webhook);
--    tidak ada policy insert untuk user biasa — mencegah pemalsuan log.
--    Baca hanya admin platform (is_admin()).
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  actor_role text not null default 'system'
    check (actor_role in ('admin', 'seller', 'staff', 'system')),
  store_id uuid references public.stores (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_store_idx
  on public.audit_log (store_id, created_at desc);

create index if not exists audit_log_action_idx
  on public.audit_log (action, created_at desc);

create index if not exists audit_log_created_idx
  on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

-- Hanya admin platform yang boleh membaca log.
drop policy if exists audit_log_admin_select on public.audit_log;
create policy audit_log_admin_select on public.audit_log
  for select to authenticated
  using (public.is_admin());

-- Tulis hanya lewat service_role (tidak ada policy insert/update/delete
-- untuk role lain — service_role melewati RLS).
