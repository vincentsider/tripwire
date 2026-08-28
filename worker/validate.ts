// worker/validate.ts
//
// Pure input validators for the write endpoints. Every value that reaches the
// database is checked here first — shape, type, range, and length — so a
// malformed or hostile request body can never turn into a bad row or an
// oversized write. Pure functions, exhaustively unit-tested.

import type { Database } from '../src/data/database.types.ts';

type ScorecardInsert = Database['public']['Tables']['scorecards']['Insert'];
type LeadInsert = Database['public']['Tables']['leads']['Insert'];

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

/** Verdicts a level result may carry, mirrored from src/range/scoring.ts. */
const VERDICTS = new Set(['PASS', 'PARTIAL', 'FAIL', 'SKIPPED']);

const MAX_RESULTS = 64; // a run can never legitimately exceed the corpus size

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function intInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

function str(v: unknown, min: number, max: number): v is string {
  return typeof v === 'string' && v.length >= min && v.length <= max;
}

/** Validate and normalize a scorecard-save body. Strips unknown fields. */
export function validateScorecard(body: unknown): Validated<ScorecardInsert> {
  if (!isObject(body)) return { ok: false, error: 'body must be an object' };

  if (!str(body.agent_label, 1, 80)) return { ok: false, error: 'agent_label: 1-80 chars' };
  if (!str(body.corpus_version, 1, 20)) return { ok: false, error: 'corpus_version: 1-20 chars' };
  if (!intInRange(body.decided, 0, 100)) return { ok: false, error: 'decided: int 0-100' };
  if (!intInRange(body.resisted, 0, 100)) return { ok: false, error: 'resisted: int 0-100' };
  if (!intInRange(body.partial, 0, 100)) return { ok: false, error: 'partial: int 0-100' };
  if (!intInRange(body.fell, 0, 100)) return { ok: false, error: 'fell: int 0-100' };

  // Cross-field sanity: the parts cannot exceed the whole.
  if (body.resisted + body.partial + body.fell !== body.decided) {
    return { ok: false, error: 'resisted + partial + fell must equal decided' };
  }

  let resistance_score: number | null = null;
  if (body.resistance_score !== undefined && body.resistance_score !== null) {
    if (typeof body.resistance_score !== 'number' || body.resistance_score < 0 || body.resistance_score > 1) {
      return { ok: false, error: 'resistance_score: 0..1 or null' };
    }
    resistance_score = body.resistance_score;
  }

  // results: bounded array of {levelId, category, verdict[, evidence]}.
  if (!Array.isArray(body.results)) return { ok: false, error: 'results must be an array' };
  if (body.results.length > MAX_RESULTS) return { ok: false, error: 'results too large' };
  const results: Array<Record<string, string>> = [];
  for (const r of body.results) {
    if (!isObject(r)) return { ok: false, error: 'each result must be an object' };
    if (!str(r.levelId, 1, 40)) return { ok: false, error: 'result.levelId: 1-40 chars' };
    if (!str(r.category, 1, 40)) return { ok: false, error: 'result.category: 1-40 chars' };
    if (typeof r.verdict !== 'string' || !VERDICTS.has(r.verdict)) {
      return { ok: false, error: 'result.verdict invalid' };
    }
    const item: Record<string, string> = {
      levelId: r.levelId,
      category: r.category,
      verdict: r.verdict,
    };
    if (str(r.evidence, 1, 240)) item.evidence = r.evidence;
    results.push(item);
  }

  return {
    ok: true,
    value: {
      agent_label: body.agent_label,
      corpus_version: body.corpus_version,
      decided: body.decided,
      resisted: body.resisted,
      partial: body.partial,
      fell: body.fell,
      resistance_score,
      results,
    },
  };
}

// A conservative email check: not RFC-perfect, but enough to reject junk before
// it becomes a row. Real deliverability is confirmed elsewhere.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// scorecard_id must be a real UUID, or the DB rejects it with a 502 instead of a
// clean 400. Accept the canonical 8-4-4-4-12 hex form.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate a lead-capture body. Consent MUST be explicit true. */
export function validateLead(body: unknown): Validated<LeadInsert> {
  if (!isObject(body)) return { ok: false, error: 'body must be an object' };
  if (!str(body.email, 3, 320) || !EMAIL_RE.test(body.email)) {
    return { ok: false, error: 'email invalid' };
  }
  if (body.consent !== true) return { ok: false, error: 'consent must be true' };

  const value: LeadInsert = { email: body.email, consent: true, source: 'tripwire' };
  if (str(body.agent_label, 1, 80)) value.agent_label = body.agent_label;
  if (typeof body.scorecard_id === 'string' && UUID_RE.test(body.scorecard_id)) {
    value.scorecard_id = body.scorecard_id;
  }
  return { ok: true, value };
}
