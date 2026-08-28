-- Rung 1 (accountability): a site's signed behaviour manifest, bound to a surface
-- fingerprint. Tripwire signs that the site MADE these claims (dated), turning a
-- later violation into a provable breach. RLS deny-all; Worker service-role only.
create table if not exists public.manifests (
  id uuid primary key default gen_random_uuid(),
  origin text not null references public.origins(origin) on delete cascade,
  fingerprint text not null check (char_length(fingerprint) = 64),
  manifest jsonb not null,
  manifest_sha256 text not null,
  signature text not null,
  key_id text not null,
  signed_at timestamptz not null default now()
);
alter table public.manifests enable row level security;
create index if not exists manifests_origin_idx on public.manifests (origin, signed_at desc);
