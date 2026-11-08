-- ============================================================================
-- Fase 0 — Peran pengguna (2026-11-08): buyer / seller / staff / admin.
--
-- Latar: sebelum file ini repo TIDAK punya konsep peran sama sekali.
-- Satu-satunya "peran" adalah kepemilikan toko (stores.owner_id =
-- auth.uid()), dicek ulang di tiap server action / halaman dashboard.
-- Penegakan tier (Fase 1) dan peran staff (rencana SaaS poin 8) butuh
-- peran yang tersimpan di database, bukan ditebak dari ada/tidaknya toko.
--
-- Desain: tabel public.profiles, 1 baris per user auth (id = auth.users.id).
--   - buyer  : pengguna terdaftar tanpa toko (default saat akun dibuat).
--              Bisa belanja dengan akun (Fase 1) tanpa harus punya toko.
--   - seller : pemilik toko (punya baris di stores dengan owner_id = id).
--   - staff  : karyawan toko; store_id menunjuk toko tempatnya bekerja.
--              Akses staff ke dashboard toko BELUM dipasang di Fase 0 —
--              policy toko masih owner-only (migrasi P0); wiring staff
--              adalah pekerjaan Fase 1/2.
--   - admin  : admin platform (mengelola semua toko/langganan, Fase 1/2).
--              Satu-satunya peran yang bisa mengubah peran orang lain.
--
-- CARA PAKAI: jalankan SETELAH 20261108_f0_core_schema.sql (profiles
-- merujuk public.stores). Aman dijalankan berulang (IF NOT EXISTS /
-- CREATE OR REPLACE / DROP POLICY IF EXISTS).
--
-- KEAMANAN:
--   - Insert baris sendiri hanya boleh dengan role 'buyer' — tidak ada
--     yang bisa mendaftarkan diri langsung sebagai seller/staff/admin.
--   - Perubahan role diblokir trigger profiles_role_guard untuk semua
--     pemanggil ber-JWT yang bukan admin. Service_role (server, tanpa
--     JWT) dikecualikan supaya promosi lewat server action tetap bisa.
--   - Admin dicek lewat fungsi SECURITY DEFINER public.is_admin() supaya
--     policy di tabel profiles sendiri tidak rekursif (policy yang
--     membaca profiles dari dalam policy profiles = infinite recursion).
--
-- BOOTSTRAP ADMIN PERTAMA (jalankan di Supabase SQL Editor; SQL Editor
-- berjalan sebagai postgres dan melewati RLS, jadi tidak butuh admin
-- yang sudah ada — ini memutus lingkaran ayam-telur):
--
--   insert into public.profiles (id, role)
--   select id, 'admin' from auth.users
--    where email = 'EMAIL_ADMIN@CONTOH.ID'
--   on conflict (id) do update set role = 'admin';
--
-- Ganti EMAIL_ADMIN@CONTOH.ID dengan email akun admin (lihat Supabase
-- Dashboard > Authentication > Users). Setelah 1 admin ada, promosi
-- peran lain dilakukan oleh admin itu (atau service_role dari server).
-- JANGAN menulis password/kredensial apa pun di file ini.
--
-- YANG BELUM DI SINI (sengaja, Fase 1/2): kode aplikasi BELUM membaca
-- atau menulis tabel ini; register belum membuat baris profiles otomatis;
-- policy toko belum mengenal staff. File ini menyiapkan fondasinya saja.
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'buyer'
    check (role in ('buyer', 'seller', 'staff', 'admin')),
  store_id uuid references public.stores (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_store_idx
  on public.profiles (store_id);

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- Helper: apakah pemanggil saat ini admin? SECURITY DEFINER supaya policy
-- di bawah bisa memakainya tanpa rekursi RLS.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Policy profiles.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_own_buyer on public.profiles;
create policy profiles_insert_own_buyer on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'buyer');

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Penjaga peran: role tidak boleh diubah oleh pemanggil ber-JWT yang bukan
-- admin. Service_role (auth.uid() null) dikecualikan — promosi lewat
-- server action tetap bisa. Trigger ini HANYA mengawasi kolom role, jadi
-- update kolom lain (mis. store_id) tidak terganggu.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Peran hanya bisa diubah oleh admin.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
  before update of role on public.profiles
  for each row execute function public.prevent_role_escalation();

-- ---------------------------------------------------------------------------
-- updated_at otomatis (bukan bagian keamanan; sekadar kerapian).
-- ---------------------------------------------------------------------------
create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_profiles_updated_at();
