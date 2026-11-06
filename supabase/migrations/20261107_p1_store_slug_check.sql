-- Migrasi P1 (2026-11-07): tegakkan format slug toko di level database.
--
-- Aplikasi sudah memvalidasi slug di halaman Pengaturan (lib/store-slug.ts),
-- tetapi constraint ini menjaga data tetap bersih dari jalur tulis lain.
-- Aman dijalankan berulang: constraint hanya ditambahkan bila belum ada,
-- dan dilewati (dengan NOTICE) bila masih ada slug lama yang melanggar —
-- perbaiki dulu slug tersebut secara manual, lalu jalankan ulang file ini.

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'stores_slug_format_check'
  ) then
    raise notice 'Constraint stores_slug_format_check sudah ada, dilewati.';
  elsif exists (
    select 1 from public.stores
    where slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
       or length(slug) < 3
       or length(slug) > 40
  ) then
    raise notice 'Ada slug lama yang melanggar format; constraint TIDAK ditambahkan. Perbaiki slug tersebut lalu jalankan ulang migrasi ini.';
  else
    alter table public.stores
      add constraint stores_slug_format_check
      check (
        slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        and length(slug) between 3 and 40
      );
    raise notice 'Constraint stores_slug_format_check ditambahkan.';
  end if;
end $$;
