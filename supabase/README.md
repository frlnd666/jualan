# Supabase — Aktivasi P0 Security

Folder ini berisi migrasi keamanan P0. Sebelumnya repo tidak menyimpan
skema/policy database sama sekali; mulai sekarang setiap perubahan skema
wajib masuk sebagai file di `migrations/`.

## Urutan aktivasi (jangan dibalik)

1. **Set env service role**
   - Supabase Dashboard → Project Settings → API → salin `service_role`.
   - Isi `SUPABASE_SERVICE_ROLE_KEY` di Vercel (Production) dan `.env.local`.
   - Key ini melewati semua RLS. Jangan beri prefix `NEXT_PUBLIC_`, jangan
     pernah commit nilai aslinya.
2. **Deploy kode** yang memakai env tersebut (branch `fix/p0-security`
   atau hasil merge-nya ke `main`), lalu pastikan aplikasi normal.
3. **Jalankan migrasi** `migrations/20261107_p0_security.sql` di
   Supabase SQL Editor. File ini:
   - menambah `invoices.access_token` (gerbang halaman invoice/track publik),
   - mengaktifkan RLS + policy kepemilikan untuk semua tabel,
   - membuat bucket `payment-proofs` privat.

Bila migrasi dijalankan sebelum langkah 1–2 selesai, halaman invoice/track
publik dan upload bukti transfer akan gagal membaca `invoices` (akses anon
sudah ditutup, sementara server belum punya service_role).

## Perilaku sebelum migrasi dijalankan

Kode dirancang tetap hidup di masa transisi:

- Checkout tetap mencoba menyimpan `access_token`; bila kolom belum ada,
  otomatis jatuh ke format lama (halaman publik berjalan di mode legacy,
  tetapi data pribadi tetap disamarkan).
- Lookup publik memakai client anon bila `SUPABASE_SERVICE_ROLE_KEY` belum
  diset, dan otomatis beralih ke service_role begitu env tersedia.

Mode transisi ini **bukan** keadaan aman final — keadaan aman tercapai
setelah ketiga langkah di atas selesai.

## Dampak yang disadari

- Link invoice lama (tanpa `?t=`) untuk invoice yang sudah punya token
  akan membuka halaman 404 setelah migrasi. Customer bisa dibantu dari
  dashboard: buka order terkait, nomor invoice + token bisa dibagikan ulang
  secara manual oleh seller.
- Setelah bucket `payment-proofs` privat, URL bukti transfer lama yang
  tersimpan berhenti bisa dibuka publik. Penayangan bukti di dashboard via
  signed URL adalah pekerjaan P1 berikutnya.
