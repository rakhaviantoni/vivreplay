alter table public.tcg_card_asset_sources
  add column if not exists storage_variants jsonb not null default '{}'::jsonb,
  add column if not exists stored_format text;

create index if not exists tcg_card_asset_printing on public.tcg_card_asset_sources(printing_id);
