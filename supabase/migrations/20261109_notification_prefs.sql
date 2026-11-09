-- ============================================================================
-- Notifikasi email + WhatsApp — preferensi penerima (2026-11-09).
--
-- CARA PAKAI: jalankan SETELAH seluruh migrasi Fase 0–5 + cron langganan,
-- di Supabase SQL Editor. Aman dijalankan berulang (IF NOT EXISTS /
-- DROP POLICY IF EXISTS). Tidak mengubah data yang sudah ada.
--
-- Isi:
--   1. notification_preferences — 1 baris per user (dibuat malas saat
--      pertama kali menyimpan pengaturan; tidak ada baris = semua aktif).
--      - email_enabled / whatsapp_enabled default true;
--      - whatsapp_number: nomor WA khusus notifikasi (nullable). Bila
--        kosong, dispatcher memakai fallback: nomor HP di alamat terakhir
--        pembeli (buyer_addresses.phone) → nomor HP di order terakhir
--        (orders.customer_phone) → nomor WhatsApp toko (stores.whatsapp
--        untuk pemilik toko).
--   2. RLS: user hanya bisa baca/ubah barisnya sendiri; admin platform
--      bisa baca semua (is_admin()); service_role (dipakai dispatcher)
--      melewati RLS seperti biasa.
--
-- PERILAKU SEBELUM MIGRASI: dispatcher memakai default (semua aktif) dan
-- fallback nomor dari order/alamat/toko; halaman pengaturan menampilkan
-- pesan "jalankan migrasi dulu" (bukan crash). In-app tetap jalan.
-- ============================================================================

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_enabled boolean not null default true,
  whatsapp_enabled boolean not null default true,
  whatsapp_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

-- Pemilik baris: baca + tulis miliknya sendiri.
drop policy if exists notification_preferences_owner_all on public.notification_preferences;
create policy notification_preferences_owner_all on public.notification_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admin platform: baca semua (untuk halaman test + bantuan).
drop policy if exists notification_preferences_admin_read on public.notification_preferences;
create policy notification_preferences_admin_read on public.notification_preferences
  for select to authenticated
  using (public.is_admin());
