create extension if not exists pgcrypto;

create table if not exists public.tcg_games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

create table if not exists public.tcg_import_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status text not null check (status in ('running', 'completed', 'failed')),
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.tcg_card_identities (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.tcg_games(id),
  code text not null,
  name text not null,
  color text not null,
  card_type text not null,
  cost integer not null default 0,
  power integer not null default 0,
  effect_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, code)
);

create table if not exists public.tcg_card_asset_sources (
  id uuid primary key default gen_random_uuid(),
  printing_id uuid,
  source_type text not null,
  source_url text not null,
  rights_status text not null,
  observed_at timestamptz,
  storage_path text,
  approved_for_display boolean not null default false,
  approved_for_storage boolean not null default false,
  created_at timestamptz not null default now(),
  unique (source_url)
);

create table if not exists public.tcg_card_printings (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.tcg_card_identities(id) on delete cascade,
  language text not null default 'EN',
  set_code text not null,
  set_name text not null,
  rarity text not null,
  variant text not null default 'Standard',
  source_kind text not null,
  asset_source_id uuid references public.tcg_card_asset_sources(id),
  created_at timestamptz not null default now(),
  unique (identity_id, language, set_code, variant)
);

alter table public.tcg_card_asset_sources
  add constraint card_asset_source_printing_fk
  foreign key (printing_id) references public.tcg_card_printings(id) on delete cascade;

create index if not exists tcg_card_identity_filter on public.tcg_card_identities (color, card_type);
create index if not exists tcg_card_printing_set on public.tcg_card_printings (set_code);

alter table public.tcg_games enable row level security;
alter table public.tcg_import_runs enable row level security;
alter table public.tcg_card_identities enable row level security;
alter table public.tcg_card_printings enable row level security;
alter table public.tcg_card_asset_sources enable row level security;

create policy "catalog games are readable" on public.tcg_games for select using (true);
create policy "catalog cards are readable" on public.tcg_card_identities for select using (true);
create policy "catalog printings are readable" on public.tcg_card_printings for select using (true);
create policy "catalog asset provenance is readable" on public.tcg_card_asset_sources for select using (true);
