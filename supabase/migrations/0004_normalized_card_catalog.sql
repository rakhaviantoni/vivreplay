-- Logical gameplay data. One row per functional card identity, independent of language and reprints.
create table if not exists public.tcg_card_rules (
  identity_id uuid primary key references public.tcg_card_identities(id) on delete cascade,
  colors jsonb not null default '[]'::jsonb,
  card_type text not null,
  cost integer not null default 0,
  power integer not null default 0,
  life integer,
  counter_amount integer not null default 0,
  attributes jsonb not null default '[]'::jsonb,
  traits jsonb not null default '[]'::jsonb,
  rules_revision text,
  updated_at timestamptz not null default now()
);

-- Localized player-facing text. A language can be added without duplicating card rules.
create table if not exists public.tcg_card_localizations (
  identity_id uuid not null references public.tcg_card_identities(id) on delete cascade,
  language text not null,
  name text not null,
  effect_text text not null default '',
  traits_text text,
  source_record_id uuid,
  updated_at timestamptz not null default now(),
  primary key (identity_id, language)
);

-- Physical printing fields only. The release is represented by set_id, never a copied set name.
alter table public.tcg_card_printings
  add column if not exists printing_code text,
  add column if not exists release_date date,
  add column if not exists is_reprint boolean not null default false;

create unique index if not exists tcg_printing_code_language_set
  on public.tcg_card_printings (set_id, language, printing_code, variant);

-- Every response row is retained, even fields not normalized yet.
create table if not exists public.tcg_source_records (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid references public.tcg_import_runs(id) on delete set null,
  source text not null,
  source_key text not null,
  payload jsonb not null,
  observed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source, source_key, observed_at)
);

-- Remote provenance is separate from the local derivatives generated from it.
create table if not exists public.tcg_card_assets (
  id uuid primary key default gen_random_uuid(),
  printing_id uuid not null references public.tcg_card_printings(id) on delete cascade,
  source_id uuid references public.tcg_card_asset_sources(id) on delete set null,
  kind text not null check (kind in ('thumb', 'small', 'large')),
  object_key text not null,
  mime_type text not null default 'image/webp',
  width integer not null,
  height integer,
  byte_size integer,
  checksum text,
  created_at timestamptz not null default now(),
  unique (printing_id, kind)
);

-- Prices are observations, not mutable properties of a card printing.
create table if not exists public.tcg_price_observations (
  id uuid primary key default gen_random_uuid(),
  printing_id uuid not null references public.tcg_card_printings(id) on delete cascade,
  source text not null,
  source_kind text not null check (source_kind in ('inventory_price', 'market_price', 'completed_sale', 'listing')),
  amount numeric not null,
  currency text not null default 'USD',
  observed_at timestamptz not null,
  source_record_id uuid references public.tcg_source_records(id) on delete set null,
  unique (printing_id, source, source_kind, observed_at)
);

create index if not exists tcg_printings_set_language on public.tcg_card_printings(set_id, language);
create index if not exists tcg_assets_printing_kind on public.tcg_card_assets(printing_id, kind);
create index if not exists tcg_prices_printing_observed on public.tcg_price_observations(printing_id, observed_at desc);

alter table public.tcg_card_rules enable row level security;
alter table public.tcg_card_localizations enable row level security;
alter table public.tcg_source_records enable row level security;
alter table public.tcg_card_assets enable row level security;
alter table public.tcg_price_observations enable row level security;

create policy "card rules are readable" on public.tcg_card_rules for select using (true);
create policy "card localizations are readable" on public.tcg_card_localizations for select using (true);
create policy "card assets are readable" on public.tcg_card_assets for select using (true);
create policy "price observations are readable" on public.tcg_price_observations for select using (true);

-- Backfill the existing English catalog. New imports write these tables directly.
insert into public.tcg_card_rules (identity_id, colors, card_type, cost, power, life, counter_amount, attributes, traits)
select id, jsonb_build_array(color), card_type, cost, power, null, 0, '[]'::jsonb, '[]'::jsonb
from public.tcg_card_identities
on conflict (identity_id) do nothing;

insert into public.tcg_card_localizations (identity_id, language, name, effect_text)
select id, 'EN', name, effect_text
from public.tcg_card_identities
on conflict (identity_id, language) do nothing;

update public.tcg_card_printings p
set printing_code = i.code
from public.tcg_card_identities i
where p.identity_id = i.id and p.printing_code is null;
