-- Trustwright database schema.
--
-- Apply to a fresh Supabase project (supabase db push, or paste into the SQL
-- editor). The Worker writes to these tables with the service-role key; RLS is
-- ENABLED with NO policies, so the anon/publishable key can neither read nor
-- write. The browser never talks to Supabase directly — everything goes through
-- the Worker (see worker/supabase.ts).

-- One row per completed gauntlet run. Contains NO personal data; the leaderboard
-- reads only non-PII columns from it.
create table if not exists public.scorecards (
  id uuid primary key default gen_random_uuid(),
  agent_label text not null check (char_length(agent_label) between 1 and 80),
  corpus_version text not null check (char_length(corpus_version) between 1 and 20),
  resistance_score real check (resistance_score >= 0 and resistance_score <= 1),
  decided smallint not null check (decided >= 0 and decided <= 100),
  resisted smallint not null check (resisted >= 0 and resisted <= 100),
  partial smallint not null check (partial >= 0 and partial <= 100),
  fell smallint not null check (fell >= 0 and fell <= 100),
  results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.scorecards enable row level security;

-- Email opt-in for the report (PII). Never exposed to the anon role.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 320),
  agent_label text,
  scorecard_id uuid references public.scorecards(id) on delete set null,
  consent boolean not null default false,
  source text not null default 'tripwire',
  created_at timestamptz not null default now()
);
alter table public.leads enable row level security;

-- Indexes: leaderboard ordering, recency, and a covering index for the FK.
create index if not exists scorecards_score_idx on public.scorecards (resistance_score desc, created_at desc);
create index if not exists leads_created_idx on public.leads (created_at desc);
create index if not exists leads_scorecard_id_idx on public.leads (scorecard_id);
