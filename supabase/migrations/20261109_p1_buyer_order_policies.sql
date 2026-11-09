-- ============================================================================
-- Policy RLS pembeli untuk order_items & shipments (2026-11-09, K-02).
--
-- CARA PAKAI: jalankan di Supabase SQL Editor, kapan saja (tidak bergantung
-- pada deploy kode — halaman detail pesanan sudah membaca kedua tabel ini
-- lewat client sesi pembeli). Aman dijalankan berulang
-- (DROP POLICY IF EXISTS). Tidak mengubah data yang sudah ada.
--
-- Masalah: halaman /akun/pesanan/[id] membaca order_items + shipments
-- memakai client sesi pembeli, tetapi policy yang ada hanya untuk
-- owner/staff — pembeli melihat daftar item kosong dan "belum ada info
-- pengiriman" tanpa error yang terlihat.
-- ============================================================================

drop policy if exists order_items_buyer_select on public.order_items;
create policy order_items_buyer_select on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
     where o.id = order_items.order_id and o.buyer_id = auth.uid()
  ));

drop policy if exists shipments_buyer_select on public.shipments;
create policy shipments_buyer_select on public.shipments
  for select to authenticated
  using (exists (
    select 1 from public.orders o
     where o.id = shipments.order_id and o.buyer_id = auth.uid()
  ));
