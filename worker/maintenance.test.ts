import { describe, it, expect, vi, afterEach } from 'vitest';
import { runOwnershipRecheck } from './maintenance.ts';
import type { Env } from './types.ts';

const NOW = Date.parse('2026-08-28T12:00:00Z');
const DAY = 86_400_000;

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    SUPABASE_URL: 'https://proj.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    ...overrides,
  } as Env;
}

interface Row {
  origin: string;
  challenge_token: string;
  verified_at: string | null;
  proof_last_ok: string | null;
}

type Proof = 'present' | 'absent' | 'unreachable';

interface PatchCall {
  target: 'origins' | 'tool_audits';
  body: Record<string, unknown> | null;
  origin: string;
}

/**
 * Stub every network call the re-check makes:
 *  - Supabase GET origins?...select=  -> the recheck batch
 *  - Supabase PATCH origins / tool_audits -> recorded, 204
 *  - GET /.well-known/... and cloudflare-dns.com -> driven by `proof`
 * `proof` is either one state for all origins or a per-origin map.
 */
function stub(opts: { rows: Row[]; proof: Proof | Record<string, Proof> }) {
  const proofFor = (origin: string): Proof =>
    typeof opts.proof === 'string' ? opts.proof : (opts.proof[origin] ?? 'unreachable');
  const calls: PatchCall[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.includes('/rest/v1/origins') && url.includes('select=') && method === 'GET') {
        return new Response(JSON.stringify(opts.rows), { status: 200 });
      }
      if (url.includes('/rest/v1/origins') && method === 'PATCH') {
        const m = /origin=eq\.([^&]+)/.exec(url);
        calls.push({
          target: 'origins',
          origin: decodeURIComponent(m?.[1] ?? ''),
          body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
        });
        return new Response(null, { status: 204 });
      }
      if (url.includes('/rest/v1/tool_audits') && method === 'PATCH') {
        const m = /origin=eq\.([^&]+)/.exec(url);
        calls.push({
          target: 'tool_audits',
          origin: decodeURIComponent(m?.[1] ?? ''),
          body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
        });
        return new Response(null, { status: 204 });
      }
      if (url.includes('/.well-known/tripwire-challenge.txt')) {
        const origin = new URL(url).origin;
        const state = proofFor(origin);
        if (state === 'present') {
          const row = opts.rows.find((r) => r.origin === origin);
          return new Response(row?.challenge_token ?? '', { status: 200 });
        }
        if (state === 'absent') return new Response('no token here', { status: 404 });
        return new Response('boom', { status: 500 }); // unreachable
      }
      if (url.includes('cloudflare-dns.com')) {
        const host = new URL(url).searchParams.get('name') ?? '';
        // host is _tripwire.<host>; map back to an origin we know.
        const bare = host.replace(/^_tripwire\./, '');
        const origin = opts.rows.find((r) => new URL(r.origin).host.split(':')[0] === bare)?.origin ?? '';
        const state = proofFor(origin);
        if (state === 'unreachable') return new Response('boom', { status: 500 });
        // present via well-known already short-circuits; here we only reach DNS
        // when well-known was absent/unreachable, so DNS returns no matching answer.
        return new Response(JSON.stringify({ Answer: [] }), { status: 200 });
      }
      throw new Error(`unexpected fetch: ${method} ${url}`);
    }),
  );
  return { calls };
}

function row(origin: string, proofAgeMs: number | null): Row {
  const ts = proofAgeMs === null ? null : new Date(NOW - proofAgeMs).toISOString();
  return { origin, challenge_token: `tok-${origin}`, verified_at: ts, proof_last_ok: ts };
}

afterEach(() => vi.unstubAllGlobals());

describe('runOwnershipRecheck', () => {
  it('refreshes proof_last_ok when the proof is still present', async () => {
    const { calls } = stub({ rows: [row('https://a.example', DAY)], proof: 'present' });
    const s = await runOwnershipRecheck(makeEnv(), NOW);
    expect(s).toMatchObject({ checked: 1, ok: 1, revoked: 0, withinGrace: 0, unreachable: 0, errors: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ target: 'origins', origin: 'https://a.example' });
    expect(calls[0]?.body).toHaveProperty('proof_last_ok');
    expect(calls[0]?.body).not.toHaveProperty('verified_at');
  });

  it('revokes when the proof has been absent past the grace window', async () => {
    // proof_last_ok 5 days ago, grace default 3 days -> revoke.
    const { calls } = stub({ rows: [row('https://gone.example', 5 * DAY)], proof: 'absent' });
    const s = await runOwnershipRecheck(makeEnv(), NOW);
    expect(s).toMatchObject({ checked: 1, revoked: 1, ok: 0, withinGrace: 0 });
    const origins = calls.filter((c) => c.target === 'origins');
    const audits = calls.filter((c) => c.target === 'tool_audits');
    expect(origins).toHaveLength(1);
    expect(origins[0]?.body).toMatchObject({ verified_at: null, proof_last_ok: null });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.body).toHaveProperty('revoked_at');
  });

  it('tolerates an absent proof still inside the grace window', async () => {
    // proof_last_ok 1 hour ago -> within 3-day grace -> no writes.
    const { calls } = stub({ rows: [row('https://blip.example', 3_600_000)], proof: 'absent' });
    const s = await runOwnershipRecheck(makeEnv(), NOW);
    expect(s).toMatchObject({ checked: 1, withinGrace: 1, revoked: 0, ok: 0 });
    expect(calls).toHaveLength(0);
  });

  it('never revokes on a transient unreachable origin', async () => {
    // proof_last_ok ancient, but the origin is unreachable, not proven absent.
    const { calls } = stub({ rows: [row('https://down.example', 30 * DAY)], proof: 'unreachable' });
    const s = await runOwnershipRecheck(makeEnv(), NOW);
    expect(s).toMatchObject({ checked: 1, unreachable: 1, revoked: 0 });
    expect(calls).toHaveLength(0);
  });

  it('does not revoke an absent proof when it has no reference timestamp', async () => {
    const r: Row = { origin: 'https://noref.example', challenge_token: 'tok-x', verified_at: null, proof_last_ok: null };
    const { calls } = stub({ rows: [r], proof: 'absent' });
    const s = await runOwnershipRecheck(makeEnv(), NOW);
    expect(s).toMatchObject({ checked: 1, withinGrace: 1, revoked: 0 });
    expect(calls).toHaveLength(0);
  });

  it('honours a custom grace window', async () => {
    // 2 days absent, grace lowered to 1 day -> revoke.
    const { calls } = stub({ rows: [row('https://strict.example', 2 * DAY)], proof: 'absent' });
    const s = await runOwnershipRecheck(makeEnv({ OWNERSHIP_GRACE_DAYS: '1' }), NOW);
    expect(s).toMatchObject({ checked: 1, revoked: 1 });
    expect(calls.some((c) => c.target === 'tool_audits')).toBe(true);
  });

  it('falls back to verified_at when proof_last_ok is null', async () => {
    // proof_last_ok null, verified_at 10 days ago -> past grace -> revoke.
    const r: Row = {
      origin: 'https://legacy.example',
      challenge_token: 'tok-l',
      verified_at: new Date(NOW - 10 * DAY).toISOString(),
      proof_last_ok: null,
    };
    const { calls } = stub({ rows: [r], proof: 'absent' });
    const s = await runOwnershipRecheck(makeEnv(), NOW);
    expect(s).toMatchObject({ checked: 1, revoked: 1 });
    expect(calls.some((c) => c.target === 'tool_audits')).toBe(true);
  });

  it('processes a mixed batch and buckets each origin correctly', async () => {
    const rows = [
      row('https://ok.example', DAY),
      row('https://revoke.example', 9 * DAY),
      row('https://grace.example', 3_600_000),
      row('https://down.example', 9 * DAY),
    ];
    const { calls } = stub({
      rows,
      proof: {
        'https://ok.example': 'present',
        'https://revoke.example': 'absent',
        'https://grace.example': 'absent',
        'https://down.example': 'unreachable',
      },
    });
    const s = await runOwnershipRecheck(makeEnv(), NOW);
    expect(s).toMatchObject({ checked: 4, ok: 1, revoked: 1, withinGrace: 1, unreachable: 1, errors: 0 });
    expect(calls.filter((c) => c.target === 'tool_audits').map((c) => c.origin)).toEqual(['https://revoke.example']);
  });

  it('is a no-op when there are no verified origins', async () => {
    const { calls } = stub({ rows: [], proof: 'present' });
    const s = await runOwnershipRecheck(makeEnv(), NOW);
    expect(s).toMatchObject({ checked: 0, ok: 0, revoked: 0 });
    expect(calls).toHaveLength(0);
  });
});
