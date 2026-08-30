-- corpus_entitlements gates access to PREMIUM attack corpora served by
-- GET /api/corpus?tier=premium. A row is a bearer token that grants a tier until
-- it expires. RLS deny-all: only the Worker's service-role key (which bypasses
-- RLS) ever reads/writes it, exactly like the other Mode-2 tables.
create table if not exists public.corpus_entitlements (
  token text primary key,
  tier text not null default 'premium',
  label text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

alter table public.corpus_entitlements enable row level security;
-- no policies => deny all by default (service role bypasses RLS)
