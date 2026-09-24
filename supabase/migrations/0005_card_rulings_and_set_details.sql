alter table public.tcg_sets
  add column if not exists release_date date,
  add column if not exists description text,
  add column if not exists official_url text,
  add column if not exists product_image_url text;

create table if not exists public.tcg_card_rulings (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.tcg_card_identities(id) on delete cascade,
  printing_id uuid references public.tcg_card_printings(id) on delete cascade,
  language text not null default 'EN',
  question text not null,
  answer text not null,
  source_url text not null,
  source_reference text,
  published_at date,
  created_at timestamptz not null default now(),
  unique (identity_id, printing_id, language, question)
);

create index if not exists tcg_card_rulings_identity_id on public.tcg_card_rulings(identity_id);
create index if not exists tcg_card_rulings_printing_id on public.tcg_card_rulings(printing_id);
alter table public.tcg_card_rulings enable row level security;
create policy "card rulings are readable" on public.tcg_card_rulings for select using (true);
