// worker/supabase.ts
//
// Thin PostgREST access using fetch. We deliberately do NOT bundle
// @supabase/supabase-js into the Worker: direct REST keeps the Worker small and
// its cold start fast. The service-role key bypasses RLS, so this file is
// Worker-only and every value written has already passed worker/validate.ts.

import type { Env } from './types.ts';
import type { Database } from '../src/data/database.types.ts';

type ScorecardInsert = Database['public']['Tables']['scorecards']['Insert'];
type LeadInsert = Database['public']['Tables']['leads']['Insert'];

/** A single leaderboard entry — non-PII columns only. */
export interface LeaderboardRow {
  agent_label: string;
  resistance_score: number | null;
  resisted: number;
  decided: number;
  created_at: string;
}

function headers(env: Env, extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function restUrl(env: Env, path: string): string {
  return `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`;
}

/** Insert a scorecard and return its id. Throws on a non-2xx response. */
export async function insertScorecard(env: Env, row: ScorecardInsert): Promise<{ id: string }> {
  const resp = await fetch(restUrl(env, 'scorecards'), {
    method: 'POST',
    headers: headers(env, { Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  });
  if (!resp.ok) throw new Error(`scorecards insert failed: ${resp.status}`);
  const rows = (await resp.json()) as Array<{ id: string }>;
  const first = rows[0];
  if (!first) throw new Error('scorecards insert returned no row');
  return { id: first.id };
}

/** Top scorecards by resistance, most recent as tiebreak. Non-PII columns only. */
export async function topScorecards(env: Env, limit: number): Promise<LeaderboardRow[]> {
  const capped = Math.max(1, Math.min(limit, 100));
  const query =
    'scorecards?select=agent_label,resistance_score,resisted,decided,created_at' +
    `&order=resistance_score.desc.nullslast,created_at.desc&limit=${capped}`;
  const resp = await fetch(restUrl(env, query), { headers: headers(env) });
  if (!resp.ok) throw new Error(`leaderboard query failed: ${resp.status}`);
  return (await resp.json()) as LeaderboardRow[];
}

/** Insert a lead. Returns nothing; throws on failure. */
export async function insertLead(env: Env, row: LeadInsert): Promise<void> {
  const resp = await fetch(restUrl(env, 'leads'), {
    method: 'POST',
    headers: headers(env, { Prefer: 'return=minimal' }),
    body: JSON.stringify(row),
  });
  if (!resp.ok) throw new Error(`leads insert failed: ${resp.status}`);
}
