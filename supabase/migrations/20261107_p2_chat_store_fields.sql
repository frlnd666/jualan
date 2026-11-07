-- Migrasi P2 (2026-11-07, DIREVISI terhadap skema live): fitur chat toko +
-- kolom profil toko tambahan + kolom shipped_at untuk shipments.
--
-- Jalankan SETELAH migrasi P0 (20261107_p0_security.sql).
-- Aman dijalankan berulang (idempotent).
--
-- CATATAN REKONSILIASI SKEMA (dari dump skema live 2026-11-07):
-- - Database SUDAH memiliki tabel `chats` + `chat_messages` versi lama
--   (model chat berbasis order: chat_id, sender_type, message). Tabel itu
--   TIDAK disentuh migrasi ini. Chat widget baru memakai tabel baru
--   `chat_sessions` + `chat_session_messages` agar tidak bertabrakan.
-- - Nama tabel kategori yang benar adalah `product_categories`
--   (bukan `categories`).
-- - Tabel `shipments` belum punya kolom `shipped_at` yang ditulis aksi
--   seller — ditambahkan di bagian 4.
--
-- Model akses chat:
-- - Pembeli (tamu, tanpa akun) TIDAK menyentuh tabel ini langsung. Semua
--   baca/tulis pembeli lewat server action dengan client service-role yang
--   memvalidasi access_token per sesi (pola yang sama dengan invoice publik).
-- - Seller memakai client user biasa; RLS di bawah membatasi ke sesi/pesan
--   milik tokonya sendiri, dan insert seller dipaksa sender = 'seller'.

-- 1. Tabel chat ----------------------------------------------------------------

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

create index if not exists chat_sessions_store_idx
  on public.chat_sessions (store_id, last_message_at desc);
create index if not exists chat_session_messages_session_idx
  on public.chat_session_messages (session_id, created_at);

alter table public.chat_sessions enable row level security;
alter table public.chat_session_messages enable row level security;

drop policy if exists chat_sessions_owner_select on public.chat_sessions;
create policy chat_sessions_owner_select on public.chat_sessions
  for select to authenticated
  using (exists (
    select 1 from public.stores s
    where s.id = chat_sessions.store_id and s.owner_id = auth.uid()
  ));

drop policy if exists chat_sessions_owner_update on public.chat_sessions;
create policy chat_sessions_owner_update on public.chat_sessions
  for update to authenticated
  using (exists (
    select 1 from public.stores s
    where s.id = chat_sessions.store_id and s.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.stores s
    where s.id = chat_sessions.store_id and s.owner_id = auth.uid()
  ));

drop policy if exists chat_session_messages_owner_select on public.chat_session_messages;
create policy chat_session_messages_owner_select on public.chat_session_messages
  for select to authenticated
  using (exists (
    select 1 from public.chat_sessions cs
    join public.stores s on s.id = cs.store_id
    where cs.id = chat_session_messages.session_id and s.owner_id = auth.uid()
  ));

drop policy if exists chat_session_messages_owner_insert on public.chat_session_messages;
create policy chat_session_messages_owner_insert on public.chat_session_messages
  for insert to authenticated
  with check (
    sender = 'seller'
    and exists (
      select 1 from public.chat_sessions cs
      join public.stores s on s.id = cs.store_id
      where cs.id = chat_session_messages.session_id and s.owner_id = auth.uid()
    )
  );

-- 2. Kolom profil toko tambahan -------------------------------------------------

alter table public.stores add column if not exists city text;
alter table public.stores add column if not exists address text;
alter table public.stores add column if not exists instagram text;

-- 3. Kategori bisa dibaca publik (nama kategori tampil di storefront) -----------

drop policy if exists product_categories_public_read on public.product_categories;
create policy product_categories_public_read on public.product_categories
  for select to anon, authenticated
  using (true);

-- 4. shipments.shipped_at (ditulis aksi input resi seller) -----------------------

alter table public.shipments
  add column if not exists shipped_at timestamptz;
