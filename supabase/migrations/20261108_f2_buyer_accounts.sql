-- ============================================================================
-- Fase 2 — Akun pembeli, staff, onboarding (2026-11-08).
--
-- Isi:
--   1. orders.buyer_id — pesanan yang dibuat pembeli login terikat ke
--      akunnya (pesanan tamu tetap buyer_id NULL, tidak berubah).
--   2. buyer_addresses — buku alamat pembeli.
--   3. buyer_carts + buyer_cart_items — keranjang tersimpan di akun
--      (satu keranjang per pembeli, satu toko saja — sama seperti aturan
--      keranjang localStorage di lib/use-cart.ts).
--   4. stores.onboarding_step — progres wizard onboarding toko
--      (0 = selesai; 1..5 = langkah berjalan). Toko lama = 0.
--   5. Helper is_staff_of_store() + policy RLS staff (ADITIF, policy
--      owner P0 tidak diubah): staff boleh baca/tulis produk, baca/ubah
--      order, baca item order, tulis resi, dan baca/ubah invoice —
--      hanya untuk toko tempatnya bekerja. Staff TIDAK diberi akses ke
--      shipping_methods, subscriptions, subscription_payments, dan chat.
--   6. Pengetatan: (a) insert toko diblokir untuk role staff — staff
--      tidak boleh membuat toko sendiri selagi terikat ke toko lain;
--      (b) trigger profiles_role_guard kini juga mengawasi kolom
--      store_id, supaya staff tidak bisa memindahkan dirinya sendiri
--      ke toko lain; (c) RPC decrement/increment_stock kini juga
--      menerima staff toko (sebelumnya hanya pemilik — pembatalan
--      order oleh staff akan gagal mengembalikan stok).
--
-- CARA PAKAI: jalankan SETELAH seluruh migrasi Fase 0 + Fase 1 di
-- Supabase SQL Editor. Aman dijalankan berulang (IF NOT EXISTS /
-- CREATE OR REPLACE / DROP POLICY IF EXISTS). Tidak mengubah data
-- yang sudah ada (orders lama tetap buyer_id NULL).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. orders.buyer_id
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists buyer_id uuid references auth.users (id) on delete set null;

create index if not exists orders_buyer_idx
  on public.orders (buyer_id, created_at desc);

-- Pembeli hanya bisa MEMBACA ordernya sendiri. Tulis order tetap lewat
-- service_role (checkout), bukan lewat policy ini.
drop policy if exists orders_buyer_select on public.orders;
create policy orders_buyer_select on public.orders
  for select to authenticated
  using (buyer_id = auth.uid());

-- Pembeli bisa membaca invoice dari ordernya sendiri (untuk tautan
-- /invoice + token di halaman riwayat pesanan).
drop policy if exists invoices_buyer_select on public.invoices;
create policy invoices_buyer_select on public.invoices
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
       where o.id = invoices.order_id
         and o.buyer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. buyer_addresses — buku alamat pembeli (satu pemilik per baris).
-- ---------------------------------------------------------------------------
create table if not exists public.buyer_addresses (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users (id) on delete cascade,
  label text not null default 'Rumah',
  recipient_name text not null,
  phone text not null,
  address text not null,
  province text not null,
  city text not null,
  postal_code text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists buyer_addresses_buyer_idx
  on public.buyer_addresses (buyer_id, created_at desc);

alter table public.buyer_addresses enable row level security;

drop policy if exists buyer_addresses_owner_all on public.buyer_addresses;
create policy buyer_addresses_owner_all on public.buyer_addresses
  for all to authenticated
  using (buyer_id = auth.uid())
  with check (buyer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. buyer_carts + buyer_cart_items — keranjang tersimpan di akun.
--    Satu keranjang per pembeli (unique buyer_id); satu toko per
--    keranjang (aturan yang sama dengan keranjang localStorage).
-- ---------------------------------------------------------------------------
create table if not exists public.buyer_carts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  updated_at timestamptz not null default now()
);

create unique index if not exists buyer_carts_buyer_idx
  on public.buyer_carts (buyer_id);

create table if not exists public.buyer_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.buyer_carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  qty integer not null check (qty > 0),
  created_at timestamptz not null default now()
);

create unique index if not exists buyer_cart_items_cart_product_idx
  on public.buyer_cart_items (cart_id, product_id);

alter table public.buyer_carts enable row level security;
alter table public.buyer_cart_items enable row level security;

drop policy if exists buyer_carts_owner_all on public.buyer_carts;
create policy buyer_carts_owner_all on public.buyer_carts
  for all to authenticated
  using (buyer_id = auth.uid())
  with check (buyer_id = auth.uid());

drop policy if exists buyer_cart_items_owner_all on public.buyer_cart_items;
create policy buyer_cart_items_owner_all on public.buyer_cart_items
  for all to authenticated
  using (
    exists (
      select 1 from public.buyer_carts c
       where c.id = buyer_cart_items.cart_id
         and c.buyer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.buyer_carts c
       where c.id = buyer_cart_items.cart_id
         and c.buyer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. stores.onboarding_step — progres wizard (0 = selesai).
-- ---------------------------------------------------------------------------
alter table public.stores
  add column if not exists onboarding_step integer not null default 0;

-- ---------------------------------------------------------------------------
-- 5. Helper staff + policy RLS staff (aditif).
-- ---------------------------------------------------------------------------
create or replace function public.is_staff_of_store(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role = 'staff' and store_id = p_store_id
  );
$$;

revoke all on function public.is_staff_of_store(uuid) from public;
grant execute on function public.is_staff_of_store(uuid) to authenticated, service_role;

-- products: staff boleh kelola katalog tokonya (baca/tambah/ubah/hapus).
drop policy if exists products_staff_select on public.products;
create policy products_staff_select on public.products
  for select to authenticated
  using (public.is_staff_of_store(store_id));

drop policy if exists products_staff_insert on public.products;
create policy products_staff_insert on public.products
  for insert to authenticated
  with check (public.is_staff_of_store(store_id));

drop policy if exists products_staff_update on public.products;
create policy products_staff_update on public.products
  for update to authenticated
  using (public.is_staff_of_store(store_id))
  with check (public.is_staff_of_store(store_id));

drop policy if exists products_staff_delete on public.products;
create policy products_staff_delete on public.products
  for delete to authenticated
  using (public.is_staff_of_store(store_id));

-- orders: staff boleh baca + ubah status (alurnya lewat server action
-- updateOrderStatusAction / saveShipmentAction, yang tetap mengecek
-- kepemilikan toko di kode).
drop policy if exists orders_staff_select on public.orders;
create policy orders_staff_select on public.orders
  for select to authenticated
  using (public.is_staff_of_store(store_id));

drop policy if exists orders_staff_update on public.orders;
create policy orders_staff_update on public.orders
  for update to authenticated
  using (public.is_staff_of_store(store_id))
  with check (public.is_staff_of_store(store_id));

-- order_items: staff boleh baca (detail pesanan).
drop policy if exists order_items_staff_select on public.order_items;
create policy order_items_staff_select on public.order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
       where o.id = order_items.order_id
         and public.is_staff_of_store(o.store_id)
    )
  );

-- shipments: staff boleh baca + tulis resi.
drop policy if exists shipments_staff_select on public.shipments;
create policy shipments_staff_select on public.shipments
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
       where o.id = shipments.order_id
         and public.is_staff_of_store(o.store_id)
    )
  );

drop policy if exists shipments_staff_insert on public.shipments;
create policy shipments_staff_insert on public.shipments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.orders o
       where o.id = shipments.order_id
         and public.is_staff_of_store(o.store_id)
    )
  );

drop policy if exists shipments_staff_update on public.shipments;
create policy shipments_staff_update on public.shipments
  for update to authenticated
  using (
    exists (
      select 1 from public.orders o
       where o.id = shipments.order_id
         and public.is_staff_of_store(o.store_id)
    )
  )
  with check (
    exists (
      select 1 from public.orders o
       where o.id = shipments.order_id
         and public.is_staff_of_store(o.store_id)
    )
  );

-- invoices: staff boleh baca + konfirmasi pembayaran (update status).
drop policy if exists invoices_staff_select on public.invoices;
create policy invoices_staff_select on public.invoices
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
       where o.id = invoices.order_id
         and public.is_staff_of_store(o.store_id)
    )
  );

drop policy if exists invoices_staff_update on public.invoices;
create policy invoices_staff_update on public.invoices
  for update to authenticated
  using (
    exists (
      select 1 from public.orders o
       where o.id = invoices.order_id
         and public.is_staff_of_store(o.store_id)
    )
  )
  with check (
    exists (
      select 1 from public.orders o
       where o.id = invoices.order_id
         and public.is_staff_of_store(o.store_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Pengetatan insert toko: role staff tidak boleh membuat toko sendiri.
--    Pengecualian: user yang BELUM punya baris profiles (baru register,
--    baris dibuat malas di layout) tetap boleh — staff SELALU punya baris
--    profiles, jadi pengecualian ini tidak membuka celah untuk staff.
-- ---------------------------------------------------------------------------
drop policy if exists "stores_owner_insert" on public.stores;
create policy "stores_owner_insert" on public.stores
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (
      not exists (select 1 from public.profiles where id = auth.uid())
      or exists (
        select 1 from public.profiles
         where id = auth.uid() and role in ('buyer', 'seller', 'admin')
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Pengetatan trigger profiles: awasi juga kolom store_id.
--    Sebelumnya trigger hanya mengawasi role — staff bisa memindahkan
--    dirinya sendiri ke toko lain lewat update store_id. Sekarang
--    perubahan role ATAU store_id oleh pemanggil ber-JWT yang bukan
--    admin ditolak; service_role (server action) dikecualikan.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.role is distinct from new.role
      or old.store_id is distinct from new.store_id)
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Peran dan penugasan toko hanya bisa diubah oleh admin.';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. RPC stok: terima juga staff toko (sebelumnya hanya pemilik).
--    Definisi lengkap ditulis ulang (CREATE OR REPLACE) dari
--    20261108_f0_stock_rpc.sql dengan satu tambahan kondisi di cek
--    kepemilikan. Hak execute tetap: authenticated + service_role.
-- ---------------------------------------------------------------------------
create or replace function public.decrement_stock(p_product_id uuid, p_qty integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_store_id uuid;
begin
  if p_qty is null or p_qty < 1 then
    raise exception 'decrement_stock: p_qty harus >= 1';
  end if;

  select stock, store_id into v_stock, v_store_id
    from public.products
   where id = p_product_id
     for update;

  if not found then
    return false;
  end if;

  -- Pemanggil ber-JWT harus pemilik ATAU staff toko; service_role
  -- (auth.uid() null) dikecualikan karena checkout server berjalan
  -- lewat service_role.
  if auth.uid() is not null then
    if not exists (
      select 1 from public.stores s
       where s.id = v_store_id and s.owner_id = auth.uid()
    ) and not public.is_staff_of_store(v_store_id) then
      return false;
    end if;
  end if;

  if v_stock is null or v_stock < p_qty then
    return false;
  end if;

  update public.products
     set stock = v_stock - p_qty
   where id = p_product_id;

  return true;
end;
$$;

create or replace function public.increment_stock(p_product_id uuid, p_qty integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_store_id uuid;
begin
  if p_qty is null or p_qty < 1 then
    raise exception 'increment_stock: p_qty harus >= 1';
  end if;

  select stock, store_id into v_stock, v_store_id
    from public.products
   where id = p_product_id
     for update;

  if not found then
    return false;
  end if;

  if auth.uid() is not null then
    if not exists (
      select 1 from public.stores s
       where s.id = v_store_id and s.owner_id = auth.uid()
    ) and not public.is_staff_of_store(v_store_id) then
      return false;
    end if;
  end if;

  update public.products
     set stock = coalesce(v_stock, 0) + p_qty
   where id = p_product_id;

  return true;
end;
$$;

revoke all on function public.decrement_stock(uuid, integer) from public;
grant execute on function public.decrement_stock(uuid, integer) to authenticated, service_role;

revoke all on function public.increment_stock(uuid, integer) from public;
grant execute on function public.increment_stock(uuid, integer) to authenticated, service_role;
