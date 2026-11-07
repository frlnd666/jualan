-- Hotfix (2026-11-07): constraint invoices_payment_status_check menolak
-- status WAITING_VERIFICATION.
--
-- Bukti produksi: upload bukti transfer berhasil naik ke storage, tetapi
-- UPDATE invoices gagal dengan
--   ERROR 23514: violates check constraint "invoices_payment_status_check"
-- karena constraint warisan skema lama hanya mengenal status lama, sedangkan
-- WAITING_VERIFICATION adalah status yang dipakai aplikasi sejak fase P1.
--
-- Perbaikan ini membangun ulang constraint sebagai GABUNGAN dari:
--   (a) semua nilai payment_status yang SUDAH ADA di data saat ini, dan
--   (b) seluruh status yang ditulis/dibaca aplikasi
--       (PENDING_PAYMENT, WAITING_VERIFICATION, PAID, FAILED, REFUNDED).
-- Jadi tidak ada nilai lama yang hilang dan tidak ada baris data yang
-- menjadi tidak valid. Aman dijalankan berulang.
--
-- Jalankan di Supabase SQL Editor. Setelah itu upload ulang bukti transfer
-- (file percobaan sebelumnya dibersihkan otomatis oleh server action).

do $$
declare
  v_values text;
begin
  select string_agg(quote_literal(x), ', ')
    into v_values
    from (
      select distinct payment_status as x
        from public.invoices
       where payment_status is not null
      union
      select unnest(array[
        'PENDING_PAYMENT',
        'WAITING_VERIFICATION',
        'PAID',
        'FAILED',
        'REFUNDED'
      ])
    ) s;

  execute 'alter table public.invoices '
       || 'drop constraint if exists invoices_payment_status_check';

  execute format(
    'alter table public.invoices add constraint invoices_payment_status_check '
    || 'check (payment_status in (%s))',
    v_values
  );
end $$;
