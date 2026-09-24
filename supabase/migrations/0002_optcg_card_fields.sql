create table if not exists public.tcg_sets (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.tcg_games(id),
  external_set_id text not null,
  name text not null,
  set_kind text not null default 'booster',
  created_at timestamptz not null default now(),
  unique (game_id, external_set_id)
);

alter table public.tcg_card_printings
  add column if not exists set_id uuid references public.tcg_sets(id),
  add column if not exists life integer,
  add column if not exists sub_types text,
  add column if not exists counter_amount integer not null default 0,
  add column if not exists attribute text,
  add column if not exists card_image_id text,
  add column if not exists card_image_url text,
  add column if not exists source_inventory_price numeric,
  add column if not exists source_market_price numeric,
  add column if not exists source_observed_at timestamptz,
  add column if not exists source_payload jsonb not null default '{}'::jsonb;

create index if not exists tcg_card_printings_set_id on public.tcg_card_printings(set_id);
create index if not exists tcg_card_printings_rarity on public.tcg_card_printings(rarity);

alter table public.tcg_sets enable row level security;
create policy "catalog sets are readable" on public.tcg_sets for select using (true);
