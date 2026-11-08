-- ============================================================================
-- Fase 1 — Langganan (2026-11-08).
--
-- Isi: tabel subscriptions (1 baris per toko) + subscription_payments
-- (riwayat pembayaran langganan, terpisah dari invoices pesanan).
-- Mengacu pada rencana SaaS Bab 3 (tier), Bab 4 (6 status), Bab 6
-- (pembayaran langganan manual terverifikasi saat peluncuran).
--
-- CARA PAKAI: jalankan SETELAH seluruh migrasi Fase 0 selesai
-- (20261108_f0_core_schema, f0_stock_rpc, f0_roles). Tabel profiles +
-- fungsi public.is_admin() yang dipakai policy di bawah berasal dari
-- 20261108_f0_roles.sql. Aman dijalankan berulang (IF NOT EXISTS /
-- DROP POLICY IF EXISTS / INSERT ... WHERE NOT EXISTS).
--
-- DESAIN:
-- - Satu baris subscriptions per toko (unique index store_id); tier dan
--   status berubah di tempat mengikuti siklus hidup Bab 4, bukan dengan
--   membuat baris baru tiap perpanjangan.
-- - Toko baru mendapat baris tier 'free' + status 'ACTIVE' — dibuat oleh
--   KODE APLIKASI saat toko dibuat (server action, service_role), bukan
--   oleh migrasi ini. Bagian backfill di bawah hanya mengisi toko LAMA
--   yang belum punya baris (dianggap Free/ACTIVE).
-- - Pembayaran langganan dicatat terpisah (subscription_payments), tidak
--   dicampur invoices pesanan. Status awal PENDING_VERIFICATION; admin
--   mengubah jadi VERIFIED/REJECTED lewat server action, lalu kode
--   aplikasi memperbarui subscriptions (periode baru + status ACTIVE).
-- - Pemilik toko TIDAK bisa mengubah subscriptions sendiri (tidak ada
--   policy update untuk owner; hanya admin). Perubahan tier/status hanya
--   lewat server action (service_role, melewati RLS) — upgrade,
--   perpanjangan, pembatalan, dan verifikasi pembayaran semuanya lewat
--   sana, supaya tidak ada yang bisa meng-upgrade dirinya sendiri
--   dengan menulis langsung ke tabel.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- subscriptions — 1 baris per toko.
--   tier: 'free' | 'silver' | 'gold' (Bab 3).
--   status: 6 status Bab 4 — TRIALING, ACTIVE, PAST_DUE, EXPIRED,
--     CANCELLED, SUSPENDED. Free = tier 'free' + status 'ACTIVE' tanpa
--     tanggal berakhir (current_period_end null).
--   trial_ends_at: akhir trial Silver 14 hari (hanya saat TRIALING).
--   grace_ends_at: akhir masa tenggang 7 hari (hanya saat PAST_DUE).
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  tier text not null default 'free'
    check (tier in ('free', 'silver', 'gold')),
  status text not null default 'ACTIVE'
    check (status in ('TRIALING', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'CANCELLED', 'SUSPENDED')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  grace_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscriptions_store_idx
  on public.subscriptions (store_id);

alter table public.subscriptions enable row level security;

-- ---------------------------------------------------------------------------
-- subscription_payments — riwayat pembayaran langganan (manual, Bab 6).
--   amount: nominal yang dibayar (numeric — terverifikasi live 2026-11-08,
--     kolom uang di live memakai numeric).
--   method: 'QRIS' | 'TRANSFER' (bayar langganan manual).
--   proof_url: bukti bayar yang diunggah penjual (storage).
--   status: PENDING_VERIFICATION -> VERIFIED / REJECTED (oleh admin).
--   verified_by / verified_at: siapa admin yang memverifikasi.
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  tier text not null check (tier in ('free', 'silver', 'gold')),
  amount numeric not null check (amount >= 0),
  method text not null check (method in ('QRIS', 'TRANSFER')),
  proof_url text,
  status text not null default 'PENDING_VERIFICATION'
    check (status in ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED')),
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists subscription_payments_store_idx
  on public.subscription_payments (store_id, created_at desc);

alter table public.subscription_payments enable row level security;

-- ---------------------------------------------------------------------------
-- Backfill/seed yang aman: toko yang sudah ada tapi belum punya baris
-- subscriptions dianggap Free/ACTIVE (Bab 4: Free adalah tier dengan
-- status ACTIVE tanpa tanggal berakhir). Idempotent — hanya mengisi toko
-- yang belum punya baris; tidak menyentuh baris yang sudah ada.
-- (Live saat migrasi ini ditulis: 0 toko — backfill ini untuk ketahanan
-- bila ada toko lama dari sebelum Fase 1.)
-- ---------------------------------------------------------------------------
insert into public.subscriptions (store_id, tier, status)
select s.id, 'free', 'ACTIVE'
from public.stores s
where not exists (
  select 1 from public.subscriptions sub where sub.store_id = s.id
);

-- ---------------------------------------------------------------------------
-- updated_at otomatis untuk subscriptions.
-- ---------------------------------------------------------------------------
create or replace function public.set_subscriptions_updated_at()
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

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_subscriptions_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: pemilik toko hanya bisa MEMBACA baris tokonya sendiri; admin
-- (public.is_admin() dari f0_roles) punya akses penuh.
-- TIDAK ADA policy INSERT/UPDATE untuk pemilik — perubahan tier/status
-- hanya lewat server action (service_role). Ini yang mencegah pemilik
-- meng-upgrade dirinya sendiri ke Gold dengan menulis langsung ke tabel.
-- Pembayaran langganan hanya bisa DIBUAT pemilik toko (sebagai
-- PENDING_VERIFICATION); perubahan status verifikasi hanya oleh admin.
-- ---------------------------------------------------------------------------
drop policy if exists subscriptions_select_own_or_admin on public.subscriptions;
create policy subscriptions_select_own_or_admin on public.subscriptions
  for select using (
    exists (select 1 from public.stores s where s.id = subscriptions.store_id and s.owner_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists subscriptions_update_own_or_admin on public.subscriptions;
drop policy if exists subscriptions_update_admin on public.subscriptions;
create policy subscriptions_update_admin on public.subscriptions
  for update using (public.is_admin())
  with check (public.is_admin());

drop policy if exists subscription_payments_select_own_or_admin on public.subscription_payments;
create policy subscription_payments_select_own_or_admin on public.subscription_payments
  for select using (
    exists (select 1 from public.stores s where s.id = subscription_payments.store_id and s.owner_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists subscription_payments_insert_owner on public.subscription_payments;
create policy subscription_payments_insert_owner on public.subscription_payments
  for insert with check (
    exists (select 1 from public.stores s where s.id = subscription_payments.store_id and s.owner_id = auth.uid())
  );

drop policy if exists subscription_payments_update_admin on public.subscription_payments;
create policy subscription_payments_update_admin on public.subscription_payments
  for update using (public.is_admin())
  with check (public.is_admin());
