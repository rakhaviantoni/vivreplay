-- PostgreSQL equivalent of the D1 shipping-origin schema.
-- Apply this migration in Supabase; drizzle/0003_shipping_origins.sql remains for D1.
create table if not exists public.seller_shipping_origins (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  label text not null,
  recipient_name text,
  phone text,
  address_line text not null,
  city text not null,
  postal_code text not null,
  area_id text,
  latitude real,
  longitude real,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seller_shipping_origins_postal_code_idx
  on public.seller_shipping_origins (postal_code);

alter table public.seller_shipping_origins enable row level security;

create policy "owners manage their shipping origin"
  on public.seller_shipping_origins
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
