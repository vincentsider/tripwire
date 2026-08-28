-- Mode 2: origin ownership + signed surface audits. RLS on, no policies —
-- only the Worker (service-role) reads/writes; the browser never touches these.

-- Origins that have proven domain control (a public badge requires verified_at).
create table if not exists public.origins (
  origin text primary key,
  challenge_token text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.origins enable row level security;

-- One row per signed surface audit.
create table if not exists public.tool_audits (
  id uuid primary key default gen_random_uuid(),
  origin text not null references public.origins(origin) on delete cascade,
  fingerprint text not null check (char_length(fingerprint) = 64),
  findings jsonb not null default '[]'::jsonb,
  assurance_score real check (assurance_score >= 0 and assurance_score <= 1),
  assurance_rung smallint not null default 0 check (assurance_rung between 0 and 4),
  report_sha256 text not null,
  signature text not null,
  key_id text not null,
  signed_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);
alter table public.tool_audits enable row level security;

create index if not exists tool_audits_origin_idx on public.tool_audits (origin, signed_at desc);
create index if not exists tool_audits_fingerprint_idx on public.tool_audits (fingerprint);
