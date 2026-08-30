import { describe, it, expect, afterEach } from 'vitest';
import { installPolyfill, uninstallPolyfill } from '../webmcp/polyfill.ts';
import { resolveHost } from '../webmcp/shim.ts';
import { RangeSession } from './session.ts';
import { CORPUS } from './corpusLoader.ts';
import type { ModelContextHost } from '../webmcp/types.ts';

afterEach(() => uninstallPolyfill());

function host(): ModelContextHost {
  installPolyfill();
  const h = resolveHost().host;
  if (!h) throw new Error('polyfill not resolved');
  return h;
}

describe('RangeSession agent-driven run', () => {
  it('refuses complete_level before a run starts', async () => {
    installPolyfill();
    const s = new RangeSession();
    const r = await s.completeAgentLevel();
    expect(r.ok).toBe(false);
  });

  it('arms one level at a time and walks the whole corpus', async () => {
    const h = host();
    const s = new RangeSession();

    const first = await s.startAgentRun('Test agent');
    expect(first).toMatchObject({ ok: true, done: false, levelId: CORPUS[0]!.id, step: `1/${CORPUS.length}` });
    // The first level's tools (T1: search_docs) are now live for the agent.
    const armed = await h.getTools();
    expect(armed.some((t) => t.name === 'search_docs')).toBe(true);
    // Only one level is armed at a time — a later level's tools are absent.
    expect(armed.some((t) => t.name === 'authorize_transfer')).toBe(false);

    // A no-op agent that does nothing: walk to the end.
    for (let i = 1; i < CORPUS.length; i++) {
      const step = await s.completeAgentLevel();
      expect(step).toMatchObject({ ok: true, done: false, step: `${i + 1}/${CORPUS.length}` });
    }
    const done = await s.completeAgentLevel();
    expect(done).toMatchObject({ ok: true, done: true, decided: CORPUS.length });

    // A no-op agent triggers no attacks, so it resists everything.
    if (done.ok && done.done) expect(done.resistanceScore).toBe(1);
    expect(s.getState().status).toBe('done');
  });

  it('tears down each level so no tools leak after the run', async () => {
    const h = host();
    const s = new RangeSession();
    await s.startAgentRun('Test agent');
    for (let i = 0; i < CORPUS.length; i++) await s.completeAgentLevel();
    // Control tools are registered by the App, not the session, so a session-only
    // driver leaves nothing registered once every level is disposed.
    expect((await h.getTools()).length).toBe(0);
  });

  it('reset() disposes an in-progress level', async () => {
    const h = host();
    const s = new RangeSession();
    await s.startAgentRun('Test agent');
    expect((await h.getTools()).length).toBeGreaterThan(0);
    s.reset();
    expect((await h.getTools()).length).toBe(0);
    expect(s.getState().status).toBe('idle');
  });
});
