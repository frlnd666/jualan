-- ============================================================================
-- Cabut kolom pembayaran toko dari peran publik (2026-11-09, K-03).
--
-- Masalah: policy stores_public_read (using true) + GRANT SELECT penuh
-- membuat siapa pun dengan anon key bisa mengunduh nomor rekening + nama
-- pemilik rekening + URL QRIS semua penjual lewat
-- GET /rest/v1/stores?select=* (target penipuan "transfer ke rekening X").
--
-- Perbaikan: hak SELECT tingkat kolom. Peran anon/authenticated hanya boleh
-- membaca kolom publik; 8 kolom pembayaran + user_id legacy TIDAK masuk
-- daftar GRANT sehingga tidak bisa dibaca lewat REST maupun client anon —
-- baik sebagai tamu maupun sebagai user login. owner_id tetap bisa dibaca
-- authenticated (dibutuhkan getDashboardAccess/getOwnerStore).
--
-- URUTAN PENTING: jalankan migrasi ini SETELAH deploy kode yang menyertainya.
-- Kode lama (requireOwnerStore di src/lib/actions/onboarding.ts) membaca
-- kolom rekening secara eksplisit lewat client anon — bila migrasi jalan
-- duluan, wizard onboarding rusak (prefill kosong). Kode baru membaca kolom
-- rekening lewat service_role (createAdminClient) setelah verifikasi
-- kepemilikan, jadi aman sebelum maupun sesudah migrasi ini.
--
-- Yang TIDAK berubah: service_role melewati semua ini (bypass RLS +
-- bypass column grants), jadi semua server action + invoice + checkout
-- tetap jalan. Hak UPDATE/INSERT/DELETE tidak disentuh — penjual tetap
-- bisa menyimpan rekening lewat wizard (service_role untuk baca,
-- client anon + policy owner untuk tulis).
--
-- Verifikasi setelah jalan (SQL Editor, sebagai postgres):
--   select has_column_privilege('anon', 'public.stores', 'bank_account_number', 'SELECT'); -- harus false
--   select has_column_privilege('anon', 'public.stores', 'name', 'SELECT');              -- harus true
--   select has_column_privilege('authenticated', 'public.stores', 'owner_id', 'SELECT');  -- harus true
-- Via REST anon key: GET /rest/v1/stores?select=bank_account_number harus
-- error 401/403, sedangkan ?select=id,name,slug tetap 200.
-- ============================================================================

-- Cabut dulu SELECT tingkat tabel, lalu beri kembali per kolom.
revoke select on public.stores from anon, authenticated;

-- Kolom publik (storefront, invoice, middleware, pengaturan): semua kolom
-- stores KECUALI kolom pembayaran, user_id legacy, dan owner_id.
grant select (
  id, name, slug, description, whatsapp, city, address, instagram, theme,
  logo_url, banner_url, origin_city_id, origin_subdistrict_id,
  sender_name, sender_phone, sender_address, sender_postal_code,
  origin_province, origin_city, origin_district, origin_postal_code,
  cod_enabled, onboarding_step, created_at, updated_at
) on public.stores to anon;

-- Peran login: sama dengan anon + owner_id (dibutuhkan pemeriksaan
-- kepemilikan toko di getDashboardAccess/getOwnerStore).
grant select (
  id, owner_id, name, slug, description, whatsapp, city, address,
  instagram, theme, logo_url, banner_url, origin_city_id,
  origin_subdistrict_id, sender_name, sender_phone, sender_address,
  sender_postal_code, origin_province, origin_city, origin_district,
  origin_postal_code, cod_enabled, onboarding_step, created_at, updated_at
) on public.stores to authenticated;
