-- Match rules are immutable snapshots. A rules correction creates a new ruleset;
-- existing matches keep the revision that governed them when they began.
create table if not exists public.tcg_rulesets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  rules_revision text not null,
  effective_from date not null,
  effective_to date,
  source_url text not null,
  status text not null default 'published' check (status in ('draft','published','retired')),
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.tcg_card_rule_revisions (
  ruleset_id uuid not null references public.tcg_rulesets(id) on delete cascade,
  identity_id uuid not null references public.tcg_card_identities(id) on delete cascade,
  effect_text text not null default '',
  effect_schema jsonb not null default '[]'::jsonb,
  errata_reference text,
  source_url text not null,
  primary key (ruleset_id, identity_id)
);

create table if not exists public.tcg_matches (
  id uuid primary key default gen_random_uuid(),
  ruleset_id uuid not null references public.tcg_rulesets(id) on delete restrict,
  player_deck jsonb not null,
  opponent_deck jsonb not null,
  state jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('setup','active','complete','abandoned')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.tcg_match_events (
  match_id uuid not null references public.tcg_matches(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  ruleset_id uuid not null references public.tcg_rulesets(id) on delete restrict,
  action jsonb not null,
  state_hash text not null,
  created_at timestamptz not null default now(),
  primary key (match_id, sequence)
);

create index if not exists tcg_rulesets_effective_window on public.tcg_rulesets (status, effective_from, effective_to);
create index if not exists tcg_card_rule_revisions_identity on public.tcg_card_rule_revisions (identity_id);
create index if not exists tcg_match_events_match_sequence on public.tcg_match_events (match_id, sequence);

alter table public.tcg_rulesets enable row level security;
alter table public.tcg_card_rule_revisions enable row level security;
alter table public.tcg_matches enable row level security;
alter table public.tcg_match_events enable row level security;
create policy "rulesets are readable" on public.tcg_rulesets for select using (true);
create policy "card rule revisions are readable" on public.tcg_card_rule_revisions for select using (true);
