-- ============================================================================
-- Kunci tulis status orders/invoices ke service_role (2026-11-09, P0).
--
-- Masalah: status orders + payment_status invoices selama ini ditulis lewat
-- client anon (peran authenticated) dari server action seller
-- (confirm-payment, order-fulfillment, order-management). Selama RLS
-- policy owner/staff mengizinkan UPDATE, siapa pun yang memegang anon key
-- + JWT user mana pun bisa mencoba mengubah status order/invoice toko lain
-- lewat REST — policy memang membatasi ke toko sendiri, tapi pembatasan
-- kolom (status vs seller_note) tidak bisa ditegakkan oleh policy: policy
-- hanya mengizinkan/menolak BARIS, bukan kolom. Satu-satunya penegak
-- tingkat kolom adalah GRANT.
--
-- Perbaikan: cabut hak UPDATE tingkat tabel dari peran authenticated,
-- lalu beri kembali HANYA kolom yang memang masih ditulis lewat anon:
--   - orders: UPDATE(seller_note) saja — dipakai saveSellerNoteAction
--     (catatan internal seller). Kolom status TIDAK masuk daftar GRANT,
--     jadi tidak ada lagi tulis status orders lewat anon.
--   - invoices: tidak ada kolom yang diberi kembali — tidak ada tulis
--     invoice lewat anon yang tersisa (upload bukti + checkout + QRIS
--     sudah lewat service_role; konfirmasi pembayaran pindah ke admin).
-- Tulis status orders/invoices kini HANYA lewat service_role
-- (createAdminClient) di ketiga server action di atas, setelah verifikasi
-- kepemilikan toko tetap dilakukan lewat client anon.
--
-- URUTAN WAJIB — KODE DEPLOY DULU, MIGRASI BELAKANGAN (kebalikan pola
-- biasa, sama seperti kasus K-03): service_role melewati RLS + column
-- grants (bypass by design), jadi setelah kode baru deploy, semua tulis
-- status tetap jalan meskipun migrasi ini sudah dijalankan. Tapi bila
-- migrasi ini dijalankan DULUAN (sebelum kode baru live), aksi seller
-- rusak: konfirmasi pembayaran, ubah status order, bulk update, dan
-- simpan resi semua gagal dengan error hak akses, karena kode lama masih
-- menulis status lewat client anon. Jadi: 1) deploy kode, 2) verifikasi
-- aksi seller jalan di produksi, 3) baru jalankan migrasi ini di
-- Supabase SQL Editor. Aman dijalankan berulang (DROP POLICY IF EXISTS,
-- REVOKE/GRANT idempotent). Tidak mengubah data yang sudah ada.
--
-- Kenapa policy UPDATE tetap dibuat ulang (bukan dihapus semua)?
-- Policy RLS dan GRANT adalah dua gerbang berbeda yang keduanya harus
-- lolos: policy mengizinkan operasi UPDATE pada BARIS milik toko itu
-- (owner/staff), sedangkan GRANT membatasi KOLOM apa yang boleh diubah.
-- Tanpa policy, RLS akan menolak UPDATE baris itu sama sekali — termasuk
-- update seller_note yang sah. Jadi policy dipertahankan dengan
-- USING/WITH CHECK kepemilikan yang sama seperti sebelumnya, dan
-- pembatasan kolom ditegakkan oleh GRANT, bukan oleh policy.
--
-- Yang TIDAK berubah:
--   - SELECT/INSERT/DELETE tidak disentuh. Policy orders_owner_delete
--     tetap ada (itu ranah P1-11, bukan batch ini).
--   - Shipments tetap ditulis lewat anon (policy shipments_owner_all +
--     shipments_staff_* dipertahankan) — hanya UPDATE status orders di
--     saveShipmentAction yang pindah ke service_role.
--   - restoreStock tetap lewat anon: RPC increment_stock mengecek
--     kepemilikan toko via JWT dan tidak boleh dipindah ke admin.
--   - Supaya service_role bisa menulis, env SUPABASE_SERVICE_ROLE_KEY
--     WAJIB sudah diset di Vercel sebelum deploy kode baru.
--
-- Verifikasi setelah jalan (SQL Editor, sebagai postgres):
--   select has_column_privilege('authenticated', 'public.orders', 'status', 'UPDATE');       -- harus false
--   select has_column_privilege('authenticated', 'public.orders', 'seller_note', 'UPDATE');  -- harus true
--   select has_table_privilege('authenticated', 'public.invoices', 'UPDATE');                -- harus false
--   (Catatan: has_table_privilege('authenticated','public.orders','UPDATE')
--   akan tetap true karena GRANT kolom seller_note — itu yang dicek adalah
--   has_column_privilege di atas, bukan hak tabel.)
-- Via REST (anon key + JWT seller): PATCH /rest/v1/orders?select=status
-- dengan body {status:"SHIPPED"} harus error 403/42501, sedangkan
-- PATCH dengan body {seller_note:"..."} pada order toko sendiri tetap 200.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- orders: cabut UPDATE tabel, beri kembali hanya kolom seller_note.
-- ---------------------------------------------------------------------------
revoke update on public.orders from authenticated;

grant update (seller_note) on public.orders to authenticated;

-- Policy UPDATE tetap diperlukan agar RLS mengizinkan operasi UPDATE pada
-- baris (lihat penjelasan di header): USING/WITH CHECK sama persis seperti
-- sebelumnya — owner (20261107_p0_security.sql) + staff (Fase 2).
drop policy if exists "orders_owner_update" on public.orders;
create policy "orders_owner_update" on public.orders
  for update to authenticated
  using (exists (
    select 1 from public.stores s
    where s.id = store_id and s.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.stores s
    where s.id = store_id and s.owner_id = auth.uid()
  ));

drop policy if exists orders_staff_update on public.orders;
create policy orders_staff_update on public.orders
  for update to authenticated
  using (public.is_staff_of_store(store_id))
  with check (public.is_staff_of_store(store_id));

-- ---------------------------------------------------------------------------
-- invoices: cabut UPDATE tabel; hapus policy UPDATE tanpa pengganti.
-- Tidak ada tulis invoice via anon yang tersisa setelah kode baru deploy.
-- ---------------------------------------------------------------------------
revoke update on public.invoices from authenticated;

drop policy if exists "invoices_owner_update" on public.invoices;
drop policy if exists invoices_staff_update on public.invoices;
