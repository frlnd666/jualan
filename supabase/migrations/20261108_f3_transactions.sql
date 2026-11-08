-- ============================================================================
-- Fase 3 — Transaksi (2026-11-08).
--
-- Isi:
--   1. store_shopeepay_credentials — kredensial ShopeePay Partner per toko
--      (client_secret + private_key disimpan TERENKRIPSI AES-256-GCM,
--      kunci platform di env SHOPEEPAY_ENCRYPTION_KEY — lihat
--      src/lib/shopeepay/crypto.ts). RLS owner-only; staff TIDAK punya
--      akses; webhook + generate QRIS memakai service_role.
--   2. qris_payments — satu baris per upaya QR dinamis (partnerReferenceNo
--      unik; satu QR PENDING per invoice via partial unique index).
--   3. invoices.expires_at — masa berlaku invoice (dipakai QRIS dinamis:
--      invoice kedaluwarsa bersama QR-nya, 20 menit; invoice manual
--      NULL = tidak kedaluwarsa).
--   4. vouchers + voucher_redemptions — diskon per toko; penegakan tier
--      (Free TIDAK bisa membuat voucher) ada di server action, bukan di
--      SQL — lihat src/lib/actions/vouchers.ts.
--   5. notifications — notifikasi in-app per user (pemilik toko +
--      pembeli login). Dibuat server-side via service_role; RLS
--      penerima-only. TIDAK ada email/WhatsApp di Fase 3 (TODO).
--   6. orders.voucher_code / discount_amount / total_weight_gram /
--      seller_note — catatan internal seller + jejak voucher & berat.
--   7. shipping_methods.courier_code / per_kg_price / base_weight_gram —
--      tarif ongkir per kg di atas berat dasar (default 1 kg pertama
--      termasuk harga dasar).
--
-- CARA PAKAI: jalankan SETELAH seluruh migrasi Fase 0 + Fase 1 + Fase 2
-- di Supabase SQL Editor. Aman dijalankan berulang (IF NOT EXISTS /
-- CREATE OR REPLACE / DROP POLICY IF EXISTS). Tidak mengubah data yang
-- sudah ada (kolom baru nullable/default; voucher/notifikasi kosong).
--
-- PERILAKU SEBELUM MIGRASI: checkout, voucher, dan notifikasi memakai
-- pola fallback yang sama seperti Fase 2 — kode mencoba kolom/tabel
-- baru, dan bila belum ada (missing-column / missing-table) jatuh ke
-- perilaku lama (tanpa voucher, ongkir tarif dasar, tanpa notifikasi).
-- QRIS dinamis butuh tabel qris_payments + kredensial; sebelum migrasi,
-- checkout QRIS tetap jalan lewat alur manual lama.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. store_shopeepay_credentials — satu baris per toko.
--    client_secret_enc / private_key_enc = ciphertext AES-256-GCM
--    format "v1:<iv-b64>:<cipher-b64>:<tag-b64>" (lihat crypto.ts).
--    Nilai ASLI secret TIDAK PERNAH disimpan di database.
-- ---------------------------------------------------------------------------
create table if not exists public.store_shopeepay_credentials (
  store_id uuid primary key references public.stores (id) on delete cascade,
  client_id text not null,
  client_secret_enc text not null,
  private_key_enc text not null,
  merchant_id text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_shopeepay_credentials enable row level security;

-- Hanya pemilik toko yang boleh membaca/menulis kredensial tokonya.
-- Staff TIDAK diberi policy apa pun di tabel ini (bahkan select).
drop policy if exists shopeepay_credentials_owner_all on public.store_shopeepay_credentials;
create policy shopeepay_credentials_owner_all on public.store_shopeepay_credentials
  for all to authenticated
  using (
    exists (
      select 1 from public.stores s
       where s.id = store_shopeepay_credentials.store_id
         and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.stores s
       where s.id = store_shopeepay_credentials.store_id
         and s.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. qris_payments — jejak QR dinamis per invoice.
--    status: PENDING (menunggu bayar) | PAID | EXPIRED | FAILED.
--    Transisi status hanya maju (webhook idempotent memakai
--    partner_reference_no sebagai kunci — lihat route notify).
-- ---------------------------------------------------------------------------
create table if not exists public.qris_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  partner_reference_no text not null,
  qr_content text,
  amount numeric not null check (amount > 0),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PAID', 'EXPIRED', 'FAILED')),
  expires_at timestamptz,
  paid_at timestamptz,
  shopeepay_trx_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists qris_payments_partner_ref_idx
  on public.qris_payments (partner_reference_no);

-- Satu QR aktif (PENDING) per invoice — generate ulang hanya boleh
-- setelah QR lama PAID/EXPIRED/FAILED.
create unique index if not exists qris_payments_invoice_pending_idx
  on public.qris_payments (invoice_id) where status = 'PENDING';

create index if not exists qris_payments_store_idx
  on public.qris_payments (store_id, created_at desc);

alter table public.qris_payments enable row level security;

-- Pemilik toko bisa membaca QR tokonya (untuk panel status di dashboard).
drop policy if exists qris_payments_owner_select on public.qris_payments;
create policy qris_payments_owner_select on public.qris_payments
  for select to authenticated
  using (
    exists (
      select 1 from public.stores s
       where s.id = qris_payments.store_id
         and s.owner_id = auth.uid()
    )
  );

-- Pembeli login bisa membaca QR dari ordernya sendiri (halaman /akun).
drop policy if exists qris_payments_buyer_select on public.qris_payments;
create policy qris_payments_buyer_select on public.qris_payments
  for select to authenticated
  using (
    exists (
      select 1
        from public.invoices i
        join public.orders o on o.id = i.order_id
       where i.id = qris_payments.invoice_id
         and o.buyer_id = auth.uid()
    )
  );

-- Tulis (insert/update) hanya lewat service_role (generate + webhook).

-- ---------------------------------------------------------------------------
-- 3. invoices.expires_at — masa berlaku invoice.
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column if not exists expires_at timestamptz;

-- ---------------------------------------------------------------------------
-- 4. vouchers + voucher_redemptions.
--    Kode unik per toko (case-insensitive). Diskon persen max 100%.
-- ---------------------------------------------------------------------------
create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  code text not null,
  discount_type text not null
    check (discount_type in ('percent', 'fixed')),
  discount_value numeric not null
    check (
      discount_value > 0
      and (discount_type <> 'percent' or discount_value <= 100)
    ),
  min_order numeric not null default 0 check (min_order >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists vouchers_store_code_idx
  on public.vouchers (store_id, upper(code));

create index if not exists vouchers_store_idx
  on public.vouchers (store_id, created_at desc);

alter table public.vouchers enable row level security;

-- Hanya pemilik toko yang boleh mengelola voucher tokonya.
-- Staff TIDAK diberi akses (voucher = keputusan harga pemilik).
-- Validasi kode saat checkout dilakukan server-side lewat service_role,
-- jadi TIDAK ada policy select publik di sini.
drop policy if exists vouchers_owner_all on public.vouchers;
create policy vouchers_owner_all on public.vouchers
  for all to authenticated
  using (
    exists (
      select 1 from public.stores s
       where s.id = vouchers.store_id
         and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.stores s
       where s.id = vouchers.store_id
         and s.owner_id = auth.uid()
    )
  );

create table if not exists public.voucher_redemptions (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  buyer_id uuid references auth.users (id) on delete set null,
  discount_amount numeric not null check (discount_amount >= 0),
  created_at timestamptz not null default now()
);

-- Satu order hanya boleh memakai satu voucher (satu baris per order).
create unique index if not exists voucher_redemptions_order_idx
  on public.voucher_redemptions (order_id);

create index if not exists voucher_redemptions_voucher_idx
  on public.voucher_redemptions (voucher_id, created_at desc);

alter table public.voucher_redemptions enable row level security;

-- Pemilik toko bisa membaca riwayat pemakaian voucher tokonya.
drop policy if exists voucher_redemptions_owner_select on public.voucher_redemptions;
create policy voucher_redemptions_owner_select on public.voucher_redemptions
  for select to authenticated
  using (
    exists (
      select 1
        from public.vouchers v
        join public.stores s on s.id = v.store_id
       where v.id = voucher_redemptions.voucher_id
         and s.owner_id = auth.uid()
    )
  );

-- Tulis hanya lewat service_role (checkout).

-- ---------------------------------------------------------------------------
-- 5. notifications — notifikasi in-app per user.
--    type: ORDER_CREATED | ORDER_PAID | PAYMENT_VERIFIED | ORDER_SHIPPED |
--    ORDER_COMPLETED | ORDER_CANCELLED | QRIS_PAID.
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  store_id uuid references public.stores (id) on delete cascade,
  order_id uuid references public.orders (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Penerima hanya bisa membaca/mengubah notifikasinya sendiri.
drop policy if exists notifications_recipient_all on public.notifications;
create policy notifications_recipient_all on public.notifications
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Tulis hanya lewat service_role (server action / webhook).

-- ---------------------------------------------------------------------------
-- 6. orders — jejak voucher, berat total, catatan internal seller.
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists voucher_code text,
  add column if not exists discount_amount numeric not null default 0
    check (discount_amount >= 0),
  add column if not exists total_weight_gram integer
    check (total_weight_gram is null or total_weight_gram > 0),
  add column if not exists seller_note text;

-- ---------------------------------------------------------------------------
-- 7. shipping_methods — tarif per kg + kode kurir.
--    per_kg_price: ongkir tambahan per kg (atau bagiannya) di atas
--    base_weight_gram pertama yang sudah termasuk di `price`.
--    courier_code: kode kurir bebas (mis. JNE, JNT, SICEPAT, TOKO) —
--    dipakai sebagai penanda di order, bukan integrasi API kurir.
-- ---------------------------------------------------------------------------
alter table public.shipping_methods
  add column if not exists courier_code text,
  add column if not exists per_kg_price numeric not null default 0
    check (per_kg_price >= 0),
  add column if not exists base_weight_gram integer not null default 1000
    check (base_weight_gram > 0);
