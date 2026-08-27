import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from './index.ts';
import type { Env, ExecutionContext } from './types.ts';

const ctx: ExecutionContext = { waitUntil: () => {}, passThroughOnException: () => {} };

function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    SUPABASE_URL: 'https://proj.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    ALLOWED_ORIGINS: 'https://app.example',
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    ...overrides,
  };
}

const goodScorecard = {
  agent_label: 'GPT-5.6',
  corpus_version: 'v1',
  decided: 2,
  resisted: 1,
  partial: 0,
  fell: 1,
  resistance_score: 0.5,
  results: [
    { levelId: 'T1', category: 'tool-framing', verdict: 'PASS' },
    { levelId: 'T2', category: 'contaminated-output', verdict: 'FAIL' },
  ],
};

// Mock the upstream PostgREST calls the Worker makes.
function stubSupabase() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/rest/v1/scorecards') && init?.method === 'POST') {
        return new Response(JSON.stringify([{ id: 'sc-123' }]), { status: 201 });
      }
      if (url.includes('/rest/v1/scorecards')) {
        return new Response(
          JSON.stringify([
            { agent_label: 'GPT-5.6', resistance_score: 0.9, resisted: 5, decided: 6, created_at: 't' },
          ]),
          { status: 200 },
        );
      }
      if (url.includes('/rest/v1/leads') && init?.method === 'POST') {
        return new Response(null, { status: 201 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

const jsonReq = (path: string, body: unknown, method = 'POST') =>
  new Request(`https://api.tripwire.test${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('worker router', () => {
  it('persists a valid scorecard', async () => {
    stubSupabase();
    const res = await worker.fetch(jsonReq('/api/scorecard', goodScorecard), baseEnv(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'sc-123' });
  });

  it('rejects an invalid scorecard with 400', async () => {
    stubSupabase();
    const bad = { ...goodScorecard, resisted: 99 };
    const res = await worker.fetch(jsonReq('/api/scorecard', bad), baseEnv(), ctx);
    expect(res.status).toBe(400);
  });

  it('returns 429 when rate-limited', async () => {
    stubSupabase();
    const env = baseEnv({ RATE_LIMITER: { limit: async () => ({ success: false }) } });
    const res = await worker.fetch(jsonReq('/api/scorecard', goodScorecard), env, ctx);
    expect(res.status).toBe(429);
  });

  it('serves the leaderboard', async () => {
    stubSupabase();
    const res = await worker.fetch(
      new Request('https://api.tripwire.test/api/leaderboard?limit=5'),
      baseEnv(),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: unknown[] };
    expect(body.rows).toHaveLength(1);
  });

  it('rejects a lead without consent', async () => {
    stubSupabase();
    const res = await worker.fetch(
      jsonReq('/api/lead', { email: 'a@b.co', consent: false }),
      baseEnv(),
      ctx,
    );
    expect(res.status).toBe(400);
  });

  it('accepts a consented lead', async () => {
    stubSupabase();
    const res = await worker.fetch(
      jsonReq('/api/lead', { email: 'a@b.co', consent: true }),
      baseEnv(),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('404s an unknown api route', async () => {
    const res = await worker.fetch(
      new Request('https://api.tripwire.test/api/nope'),
      baseEnv(),
      ctx,
    );
    expect(res.status).toBe(404);
  });

  it('answers a CORS preflight for an allowed origin', async () => {
    const res = await worker.fetch(
      new Request('https://api.tripwire.test/api/scorecard', {
        method: 'OPTIONS',
        headers: { Origin: 'https://app.example' },
      }),
      baseEnv(),
      ctx,
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
  });

  it('does not reflect a non-allowlisted origin', async () => {
    const res = await worker.fetch(
      new Request('https://api.tripwire.test/api/scorecard', {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example' },
      }),
      baseEnv(),
      ctx,
    );
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('fails the detector closed (503) when no daily-cap KV is bound', async () => {
    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array(1024)], { type: 'audio/webm' }), 'a.webm');
    const res = await worker.fetch(
      new Request('https://api.tripwire.test/api/verify-audio', { method: 'POST', body: form }),
      baseEnv({ DEEPFAKE_API_KEY: 'k' }), // key present, but no DAILY binding
      ctx,
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ reason: 'daily_cap' });
  });
});
