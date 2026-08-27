// worker/index.ts
//
// The Tripwire Worker: one deploy that serves the static SPA and the /api/*
// surface. It holds every secret (Supabase service-role, detector key); the
// browser holds none. Each endpoint validates input, rate-limits by IP, and
// never leaks internal error detail.
//
// Routes:
//   GET  /api/health         liveness; warms the detector in the background
//   POST /api/scorecard      persist a completed run -> { id }
//   GET  /api/leaderboard    top runs (non-PII) -> { rows }
//   POST /api/lead           email opt-in for the report -> { ok }
//   POST /api/verify-audio   detector proxy (rate-limited + daily-capped)
//   *                        static assets (SPA)

import type { Env, ExecutionContext } from './types.ts';
import { json, preflight } from './http.ts';
import { validateScorecard, validateLead } from './validate.ts';
import { insertScorecard, insertLead, topScorecards } from './supabase.ts';
import { checkRate, underDailyCap, clientIp } from './limits.ts';
import { analyzeAudio, warmDetector, MAX_AUDIO_BYTES } from './detector.ts';

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

async function handleScorecard(req: Request, env: Env): Promise<Response> {
  if (!(await checkRate(env, `${clientIp(req)}:scorecard`))) {
    return json({ error: 'rate_limited' }, { status: 429, req, env });
  }
  const parsed = validateScorecard(await readJson(req));
  if (!parsed.ok) return json({ error: parsed.error }, { status: 400, req, env });
  try {
    const { id } = await insertScorecard(env, parsed.value);
    return json({ id }, { req, env });
  } catch {
    return json({ error: 'persist_failed' }, { status: 502, req, env });
  }
}

async function handleLeaderboard(req: Request, env: Env): Promise<Response> {
  if (!(await checkRate(env, `${clientIp(req)}:leaderboard`))) {
    return json({ error: 'rate_limited' }, { status: 429, req, env });
  }
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? '20');
  try {
    const rows = await topScorecards(env, Number.isFinite(limit) ? limit : 20);
    return json({ rows }, { req, env });
  } catch {
    return json({ error: 'query_failed' }, { status: 502, req, env });
  }
}

async function handleLead(req: Request, env: Env): Promise<Response> {
  if (!(await checkRate(env, `${clientIp(req)}:lead`))) {
    return json({ error: 'rate_limited' }, { status: 429, req, env });
  }
  const parsed = validateLead(await readJson(req));
  if (!parsed.ok) return json({ error: parsed.error }, { status: 400, req, env });
  try {
    await insertLead(env, parsed.value);
    return json({ ok: true }, { req, env });
  } catch {
    return json({ error: 'persist_failed' }, { status: 502, req, env });
  }
}

async function handleVerifyAudio(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!(await checkRate(env, `${clientIp(req)}:verify`))) {
    return json({ error: 'rate_limited' }, { status: 429, req, env });
  }
  const cap = Number(env.DETECTOR_DAILY_CAP ?? '500');
  if (!(await underDailyCap(env, 'verify', Number.isFinite(cap) ? cap : 500))) {
    return json({ status: 'unavailable', reason: 'daily_cap' }, { status: 503, req, env });
  }

  // Read the uploaded audio (multipart) with a hard size guard.
  let audio: Blob | null = null;
  try {
    const form = await req.formData();
    const file = form.get('audio');
    if (file instanceof Blob) audio = file;
  } catch {
    return json({ error: 'bad_upload' }, { status: 400, req, env });
  }
  if (!audio || audio.size === 0) return json({ error: 'no_audio' }, { status: 400, req, env });
  if (audio.size > MAX_AUDIO_BYTES) return json({ error: 'audio_too_large' }, { status: 413, req, env });

  const result = await analyzeAudio(env, audio);
  // Keep the container warm for the next caller regardless of this outcome.
  ctx.waitUntil(warmDetector(env));
  return json(result, { req, env });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') return preflight(req, env);

    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/health' && req.method === 'GET') {
        ctx.waitUntil(warmDetector(env));
        return json({ ok: true, service: 'tripwire' }, { req, env });
      }
      if (url.pathname === '/api/scorecard' && req.method === 'POST') return handleScorecard(req, env);
      if (url.pathname === '/api/leaderboard' && req.method === 'GET') return handleLeaderboard(req, env);
      if (url.pathname === '/api/lead' && req.method === 'POST') return handleLead(req, env);
      if (url.pathname === '/api/verify-audio' && req.method === 'POST') {
        return handleVerifyAudio(req, env, ctx);
      }
      return json({ error: 'not_found' }, { status: 404, req, env });
    }

    // Everything else is the SPA. not_found_handling=single-page-application
    // in wrangler.toml serves index.html for client-side routes.
    if (env.ASSETS) return env.ASSETS.fetch(req);
    return new Response('Not found', { status: 404 });
  },

  // Cron keep-warm (wrangler [triggers] crons). Runs through the judging window
  // so the detector is never cold when a judge tries the live level.
  async scheduled(_event: unknown, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(warmDetector(env));
  },
};
