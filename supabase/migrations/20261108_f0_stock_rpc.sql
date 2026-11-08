-- ============================================================================
-- Fase 0 — Stok transaksional (2026-11-08).
--
-- Masalah yang diperbaiki: checkout mengurangi stok dari kode aplikasi
-- dengan optimistic lock (update ... where stock = nilai_lama) + rollback
-- manual yang menulis ulang nilai stok lama (src/lib/actions/checkout.ts).
-- Dua celah di pola itu:
--   (1) Antara baca stok dan update, checkout lain bisa lolos dari stok
--       yang sama — optimistic lock hanya membuat salah satunya gagal
--       DAN mengulang, bukan menjamin atomik.
--   (2) Rollback menulis ulang nilai stok lama; bila ada perubahan stok
--       lain di antaranya (checkout lain / edit seller), nilai itu tertimpa.
--
-- Perbaikan: dua fungsi SECURITY DEFINER di bawah. Keduanya mengunci baris
-- produk (SELECT ... FOR UPDATE) lalu memeriksa dan mengubah stok di dalam
-- satu transaksi Postgres — tidak ada celah baca-ubah-tulis lagi.
--
-- CARA PAKAI: jalankan SETELAH 20261108_f0_core_schema.sql (fungsi ini
-- membaca/menulis public.products). Aman dijalankan berulang
-- (CREATE OR REPLACE + REVOKE/GRANT ulang).
--
-- HAK AKSES: fungsi ini SECURITY DEFINER (melewati RLS), jadi hak execute
-- dibatasi eksplisit: hanya `authenticated` + `service_role`, TIDAK untuk
-- `anon` (REVOKE FROM public lalu GRANT ulang). Checkout memanggil lewat
-- service_role (createPublicInvoiceClient); pengembalian stok saat cancel
-- memanggil lewat client seller yang login. Bila dipanggil dengan JWT
-- user (bukan service_role), fungsi menolak bila pemanggil bukan pemilik
-- toko produk itu — jadi seller tidak bisa mengutak-atik stok toko lain
-- lewat RPC ini, dan pembeli yang login tidak bisa mengutak-atik stok
-- siapa pun. Pemanggilan service_role (server) tidak kena cek pemilik
-- karena service_role tidak membawa JWT (auth.uid() null).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- decrement_stock: kurangi stok sebanyak p_qty, hanya bila stok cukup.
-- Mengembalikan true bila berhasil, false bila produk tidak ada, stok
-- tidak cukup, atau pemanggil bukan pemilik toko. Melempar exception
-- bila p_qty < 1.
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

  -- Pemanggil ber-JWT harus pemilik toko; service_role (auth.uid() null)
  -- dikecualikan karena checkout server berjalan lewat service_role.
  if auth.uid() is not null then
    if not exists (
      select 1 from public.stores s
       where s.id = v_store_id and s.owner_id = auth.uid()
    ) then
      return false;
    end if;
  end if;

  -- stock NULL diperlakukan sebagai 0 (sama seperti kode checkout:
  -- Number(stock ?? 0)) — stok tidak cukup.
  if v_stock is null or v_stock < p_qty then
    return false;
  end if;

  update public.products
     set stock = v_stock - p_qty
   where id = p_product_id;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- increment_stock: kembalikan stok sebanyak p_qty (dipakai saat order
-- dibatalkan dan saat rollback checkout). Mengembalikan true bila
-- berhasil, false bila produk tidak ada atau pemanggil bukan pemilik toko.
-- Melempar exception bila p_qty < 1.
-- ---------------------------------------------------------------------------
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
    ) then
      return false;
    end if;
  end if;

  update public.products
     set stock = coalesce(v_stock, 0) + p_qty
   where id = p_product_id;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Hak execute: cabut dari semua (termasuk anon), beri hanya ke
-- authenticated + service_role. Tanpa baris ini, fungsi Postgres bisa
-- dipanggil siapa pun (default: PUBLIC).
-- ---------------------------------------------------------------------------
revoke all on function public.decrement_stock(uuid, integer) from public;
grant execute on function public.decrement_stock(uuid, integer) to authenticated, service_role;

revoke all on function public.increment_stock(uuid, integer) from public;
grant execute on function public.increment_stock(uuid, integer) to authenticated, service_role;
