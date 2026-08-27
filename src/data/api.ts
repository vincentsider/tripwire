// src/data/api.ts
//
// Browser-side client for the Tripwire Worker. Persistence is OPTIONAL: if no
// Worker origin is configured (local dev, or a build without the var), every
// call degrades to a harmless no-op and the range still runs end to end. This
// mirrors SimplyDash's "degrade gracefully" pattern — the demo is never one
// backend outage away from being dead.
//
// The browser holds no Supabase or detector key; it only talks to the Worker.

import type { Scorecard, LevelResult } from '../range/scoring.ts';

// Empty string => same-origin (Worker serves the SPA). Undefined var => no
// backend configured => persistence disabled.
const ORIGIN: string | undefined = import.meta.env.VITE_WORKER_ORIGIN;

/** Whether a backend is configured at all. */
export function persistenceEnabled(): boolean {
  return ORIGIN !== undefined;
}

function apiUrl(path: string): string {
  const base = (ORIGIN ?? '').replace(/\/$/, '');
  return `${base}${path}`;
}

async function postJson(path: string, body: unknown): Promise<unknown | null> {
  if (!persistenceEnabled()) return null;
  try {
    const resp = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null; // persistence must never break the run
  }
}

/** Persist a completed scorecard. Returns its server id, or null if not saved. */
export async function saveScorecard(
  scorecard: Scorecard,
  agentLabel: string,
  corpusVersion: string,
): Promise<string | null> {
  const body = {
    agent_label: agentLabel,
    corpus_version: corpusVersion,
    decided: scorecard.decided,
    resisted: scorecard.resisted,
    partial: scorecard.partial,
    fell: scorecard.fell,
    resistance_score: scorecard.resistanceScore,
    results: scorecard.results.map((r: LevelResult) => ({
      levelId: r.levelId,
      category: r.category,
      verdict: r.verdict,
      ...(r.evidence ? { evidence: r.evidence } : {}),
    })),
  };
  const out = (await postJson('/api/scorecard', body)) as { id?: string } | null;
  return out?.id ?? null;
}

export interface LeaderboardEntry {
  agent_label: string;
  resistance_score: number | null;
  resisted: number;
  decided: number;
  created_at: string;
}

/** Fetch the leaderboard. Returns [] when persistence is off or on error. */
export async function getLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  if (!persistenceEnabled()) return [];
  try {
    const resp = await fetch(apiUrl(`/api/leaderboard?limit=${limit}`));
    if (!resp.ok) return [];
    const out = (await resp.json()) as { rows?: LeaderboardEntry[] };
    return out.rows ?? [];
  } catch {
    return [];
  }
}

/** Submit an email opt-in for the report. Returns whether it was accepted. */
export async function submitLead(
  email: string,
  consent: boolean,
  extra?: { agentLabel?: string; scorecardId?: string },
): Promise<boolean> {
  const body: Record<string, unknown> = { email, consent };
  if (extra?.agentLabel) body.agent_label = extra.agentLabel;
  if (extra?.scorecardId) body.scorecard_id = extra.scorecardId;
  const out = (await postJson('/api/lead', body)) as { ok?: boolean } | null;
  return out?.ok === true;
}
