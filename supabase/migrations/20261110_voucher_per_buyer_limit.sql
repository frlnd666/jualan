-- Batas pemakaian voucher PER PEMBELI (lanjutan audit 2026-11-09).
--
-- Sebelumnya voucher hanya punya kuota global (max_uses/used_count):
-- satu pembeli bisa memakai kode yang sama berulang kali sampai kuota
-- global habis. Kolom baru ini memberi seller opsi "maks N kali per
-- pembeli" (kosong/NULL = tanpa batas per pembeli, perilaku lama).
--
-- Penegakan: server action menghitung baris voucher_redemptions untuk
-- (voucher_id, buyer_id) — baris redemption dihapus saat order
-- dibatalkan (applyCancellationEffects), jadi hitungan selalu =
-- pemakaian yang masih berlaku. Tidak perlu tabel baru.
--
-- PERILAKU SEBELUM MIGRASI: kode aplikasi toleran — query voucher
-- mencoba kolom baru dan jatuh ke daftar kolom lama bila kolom belum
-- ada (batas per pembeli dianggap tidak diset). Jalankan file ini di
-- Supabase SQL Editor untuk mengaktifkan fiturnya.

alter table public.vouchers
  add column if not exists max_uses_per_buyer integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vouchers_max_uses_per_buyer_check'
  ) then
    alter table public.vouchers
      add constraint vouchers_max_uses_per_buyer_check
      check (max_uses_per_buyer is null or max_uses_per_buyer >= 1);
  end if;
end $$;
