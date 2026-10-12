-- Product references for sealed listings. Seller inventory and listings remain
-- separate from card printings and user-owned card copies.
create table if not exists public.tcg_sealed_products (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  game_slug text not null,
  name text not null,
  product_kind text not null check (product_kind in ('BOOSTER_PACK','BOOSTER_BOX','CASE','STARTER_DECK','DOUBLE_PACK','COLLECTION','OTHER')),
  set_code text,
  set_name text,
  language text not null default '',
  release_date date,
  source_url text,
  updated_at timestamptz not null default now(),
  unique (source, external_id, language)
);

create index if not exists tcg_sealed_products_game_set_kind
  on public.tcg_sealed_products (game_slug, set_code, product_kind, name);

alter table public.tcg_sealed_products enable row level security;
-- No public Supabase policy: provider data is served through bounded app
-- queries after the commercial license is active, never as a bulk table dump.
