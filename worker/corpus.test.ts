import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from './index.ts';
import type { Env, ExecutionContext } from './types.ts';

const ctx: ExecutionContext = { waitUntil: () => {}, passThroughOnException: () => {} };

function env(overrides: Partial<Env> = {}): Env {
  return {
    SUPABASE_URL: 'https://proj.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    ADMIN_TOKEN: 'admin-secret',
    ...overrides,
  } as Env;
}

/** Stub the corpus_entitlements REST calls. `tier` = what a GET lookup returns. */
function stubDb(opts: { tier?: string | null; expired?: boolean } = {}) {
  const state = { inserted: null as null | Record<string, unknown> };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      const method = init?.method ?? 'GET';
      if (u.includes('/rest/v1/corpus_entitlements') && method === 'GET') {
        const rows = opts.tier
          ? [{ tier: opts.tier, expires_at: opts.expired ? '2000-01-01T00:00:00Z' : null }]
          : [];
        return new Response(JSON.stringify(rows), { status: 200 });
      }
      if (u.includes('/rest/v1/corpus_entitlements') && method === 'POST') {
        state.inserted = JSON.parse(String(init?.body));
        return new Response(null, { status: 201 });
      }
      throw new Error(`unexpected fetch: ${method} ${u}`);
    }),
  );
  return state;
}

const get = (path: string, headers: Record<string, string> = {}) =>
  new Request(`https://trustwright.example${path}`, { headers });
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://trustwright.example${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

afterEach(() => vi.unstubAllGlobals());

describe('GET /api/corpus', () => {
  it('public tier returns an empty spec list (public specs ship in the client)', async () => {
    stubDb();
    const resp = await worker.fetch(get('/api/corpus?tier=public'), env(), ctx);
    expect(resp.status).toBe(200);
    expect(await resp.json()).toMatchObject({ tier: 'public', specs: [] });
  });

  it('premium without a token is 401', async () => {
    stubDb();
    const resp = await worker.fetch(get('/api/corpus?tier=premium'), env(), ctx);
    expect(resp.status).toBe(401);
  });

  it('premium with an unknown token is 403', async () => {
    stubDb({ tier: null });
    const resp = await worker.fetch(get('/api/corpus?tier=premium', { 'x-corpus-token': 'nope' }), env(), ctx);
    expect(resp.status).toBe(403);
  });

  it('premium with an EXPIRED token is 403', async () => {
    stubDb({ tier: 'premium', expired: true });
    const resp = await worker.fetch(get('/api/corpus?tier=premium', { 'x-corpus-token': 'old' }), env(), ctx);
    expect(resp.status).toBe(403);
  });

  it('premium with a valid token returns the premium specs', async () => {
    stubDb({ tier: 'premium' });
    const resp = await worker.fetch(get('/api/corpus?tier=premium', { 'x-corpus-token': 'good' }), env(), ctx);
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { tier: string; specs: unknown[] };
    expect(body.tier).toBe('premium');
    expect(body.specs.length).toBeGreaterThan(0);
  });
});

describe('POST /api/corpus/grant', () => {
  it('is admin-gated', async () => {
    stubDb();
    const resp = await worker.fetch(post('/api/corpus/grant', { label: 'x' }), env(), ctx);
    expect(resp.status).toBe(403);
  });

  it('mints an entitlement token with the admin token', async () => {
    const s = stubDb();
    const resp = await worker.fetch(post('/api/corpus/grant', { label: 'Acme', days: 30 }, { 'x-admin-token': 'admin-secret' }), env(), ctx);
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { token: string; tier: string; expiresAt: string | null };
    expect(body.token.startsWith('corpus-')).toBe(true);
    expect(body.tier).toBe('premium');
    expect(s.inserted?.token).toBe(body.token);
    expect(s.inserted?.expires_at).toBeTruthy();
  });
});
