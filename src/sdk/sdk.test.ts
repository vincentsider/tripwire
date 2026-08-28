import { describe, it, expect, vi, afterEach } from 'vitest';
import { classifyLeaks } from './probe.ts';
import { audit, requestVerification, confirmVerification, preflight } from './index.ts';
import { fingerprintSurface } from '../range/fingerprint.ts';
import type { RegisteredTool } from '../webmcp/types.ts';

const tools: RegisteredTool[] = [
  { name: 'search_docs', description: 'Search.', annotations: { readOnlyHint: true } },
];

function stubBrowser(fetchImpl: typeof fetch) {
  vi.stubGlobal('location', { origin: 'https://site.example' });
  vi.stubGlobal('document', { modelContext: { getTools: async () => tools } });
  vi.stubGlobal('navigator', {});
  vi.stubGlobal('fetch', vi.fn(fetchImpl));
}

afterEach(() => vi.unstubAllGlobals());

describe('classifyLeaks', () => {
  const canary = 'TW-ABCDEFGH';
  it('ignores same-origin requests', () => {
    const r = classifyLeaks([{ toolName: 't', url: 'https://site.example/x?c=' + canary, method: 'GET' }], canary, 'https://site.example');
    expect(r).toHaveLength(0);
  });
  it('flags a canary leaked to a third-party origin (url or body)', () => {
    const r = classifyLeaks(
      [
        { toolName: 'a', url: 'https://evil.example/collect?c=' + canary, method: 'GET' },
        { toolName: 'b', url: 'https://evil.example/post', method: 'POST', body: 'data=' + canary },
        { toolName: 'c', url: 'https://evil.example/clean', method: 'GET' },
      ],
      canary,
      'https://site.example',
    );
    expect(r.map((f) => f.toolName)).toEqual(['a', 'b']);
    expect(r[0]!.targetOrigin).toBe('https://evil.example');
  });
});

describe('SDK submit + verification', () => {
  it('audit() submits the surface and returns the signed result', async () => {
    stubBrowser(async () =>
      new Response(JSON.stringify({ report: { fingerprint: 'f' }, sha256: 's', signature: 'sig', keyId: 'k1' }), { status: 200 }),
    );
    const r = await audit({ origin: 'https://site.example' });
    expect(r.ok).toBe(true);
    expect(r.signature).toBe('sig');
  });

  it('audit() surfaces a server error (e.g. unverified origin)', async () => {
    stubBrowser(async () => new Response(JSON.stringify({ error: 'origin not verified' }), { status: 403 }));
    const r = await audit({ origin: 'https://site.example' });
    expect(r).toMatchObject({ ok: false, error: 'origin not verified' });
  });

  it('requestVerification() returns a token', async () => {
    stubBrowser(async () => new Response(JSON.stringify({ token: 'tripwire-verify-x', instructions: {} }), { status: 200 }));
    const r = await requestVerification({ origin: 'https://site.example' });
    expect(r).toMatchObject({ ok: true, token: 'tripwire-verify-x' });
  });

  it('confirmVerification() reports verified true/false', async () => {
    stubBrowser(async () => new Response(JSON.stringify({ verified: true }), { status: 200 }));
    expect(await confirmVerification({ origin: 'https://site.example' })).toMatchObject({ ok: true, verified: true });
  });
});

describe('agent-side preflight', () => {
  it('ok when the live surface matches the signed fingerprint', async () => {
    const fp = await fingerprintSurface(tools);
    stubBrowser(async () => new Response(JSON.stringify({ state: 'active', fingerprint: fp }), { status: 200 }));
    const r = await preflight('https://site.example', tools);
    expect(r.trust).toBe('ok');
  });

  it('drifted when the live surface differs from the signed fingerprint', async () => {
    stubBrowser(async () => new Response(JSON.stringify({ state: 'active', fingerprint: 'a'.repeat(64) }), { status: 200 }));
    const r = await preflight('https://site.example', tools);
    expect(r.trust).toBe('drifted');
  });

  it('passes through non-active states (revoked/unverified/none)', async () => {
    stubBrowser(async () => new Response(JSON.stringify({ state: 'revoked' }), { status: 200 }));
    expect((await preflight('https://site.example', tools)).trust).toBe('revoked');
  });
});
