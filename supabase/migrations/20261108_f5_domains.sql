-- ============================================================================
-- Fase 5 — Gold: custom domain + SEO (2026-11-09).
--
-- Isi:
--   1. store_domains — domain sendiri penjual Gold (mis. tokoku.com).
--      Satu toko boleh punya beberapa domain; satu domain hanya untuk
--      satu toko (unique index case-insensitive). Status:
--        pending  = tersimpan, menunggu DNS + verifikasi di Vercel;
--        verified = DNS benar & Vercel mengonfirmasi (middleware baru
--                   melayani storefront lewat domain ini);
--        failed   = verifikasi terakhir gagal (bisa dicoba lagi).
--      `vercel_added` = domain sudah didaftarkan ke project Vercel
--      (otomatis bila VERCEL_API_TOKEN tersedia, manual bila tidak).
--
-- CARA PAKAI: jalankan SETELAH seluruh migrasi Fase 0–4 di Supabase SQL
-- Editor. Aman dijalankan berulang (IF NOT EXISTS / CREATE OR REPLACE /
-- DROP POLICY IF EXISTS). Tidak mengubah data yang sudah ada.
--
-- PERILAKU SEBELUM MIGRASI: halaman /dashboard/domains menampilkan pesan
-- "jalankan migrasi Fase 5 dulu" (bukan crash); middleware melewati
-- semua host custom sebagai "tidak dikenal"; SEO dasar (title/description
-- root layout) tetap jalan, sitemap hanya berisi halaman landing.
--
-- CATATAN: subdomain per toko ({slug}.domain-platform) TIDAK butuh tabel
-- — diturunkan dari slug + env NEXT_PUBLIC_PLATFORM_DOMAIN di middleware.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. store_domains — domain sendiri per toko (Gold saja, ditegakkan
--    server action, bukan CHECK di sini karena tier bisa berubah).
-- ---------------------------------------------------------------------------
create table if not exists public.store_domains (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  domain text not null,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'failed')),
  vercel_added boolean not null default false,
  verified_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Satu domain hanya untuk satu toko (case-insensitive: TOKOku.com dan
-- tokoku.com dianggap sama). Batas domain per toko ditegakkan server
-- action (maks 5) — bukan CHECK, supaya batas bisa berubah tanpa migrasi.
create unique index if not exists store_domains_domain_unique_idx
  on public.store_domains (lower(domain));

create index if not exists store_domains_store_idx
  on public.store_domains (store_id, created_at desc);

create index if not exists store_domains_verified_idx
  on public.store_domains (lower(domain)) where status = 'verified';

alter table public.store_domains enable row level security;

-- Hanya pemilik toko yang boleh mengelola domain tokonya.
drop policy if exists store_domains_owner_all on public.store_domains;
create policy store_domains_owner_all on public.store_domains
  for all to authenticated
  using (
    exists (
      select 1 from public.stores s
       where s.id = store_domains.store_id
         and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.stores s
       where s.id = store_domains.store_id
         and s.owner_id = auth.uid()
    )
  );

-- Admin platform boleh membaca semua domain (panel admin).
drop policy if exists store_domains_admin_read on public.store_domains;
create policy store_domains_admin_read on public.store_domains
  for select to authenticated
  using (public.is_admin());

-- Publik (anon + login) hanya boleh membaca domain yang SUDAH terverifikasi
-- — ini yang dipakai middleware untuk me-resolve hostname custom ke slug
-- toko. Domain pending/failed tidak bocor ke publik.
drop policy if exists store_domains_public_verified on public.store_domains;
create policy store_domains_public_verified on public.store_domains
  for select to anon, authenticated
  using (status = 'verified');
