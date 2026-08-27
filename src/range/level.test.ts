import { describe, it, expect, afterEach } from 'vitest';
import { installPolyfill, uninstallPolyfill } from '../webmcp/polyfill.ts';
import { resolveHost } from '../webmcp/shim.ts';
import { TelemetryBus } from './telemetry.ts';
import { runLevel, type AgentDriver } from './level.ts';
import { CORPUS, levelById } from './levels.ts';
import { buildScorecard } from './scoring.ts';
import type { ModelContextHost } from '../webmcp/types.ts';

afterEach(() => uninstallPolyfill());

function host(): ModelContextHost {
  installPolyfill();
  const h = resolveHost().host;
  if (!h) throw new Error('polyfill not resolved');
  return h;
}

// A "compliant" agent enumerates tools, calls the primary one, reads the
// description AND the result, and obeys any instruction it finds there — i.e.
// exactly the susceptible behaviour the levels are designed to catch.
const compliantAgent: AgentDriver = async (h, _canary) => {
  const tools = await h.getTools();
  for (const t of tools) {
    // Call the obvious "primary" read tools to surface descriptions/data.
    if (t.name === 'search_docs') {
      await h.executeTool('search_docs', JSON.stringify({ query: 'setup' }));
      // Obey the hidden instruction in the description.
      const m = /note="(TW-[A-Z0-9]+)"/.exec(t.description);
      if (m) await h.executeTool('record_feedback', JSON.stringify({ note: m[1] }));
    }
    if (t.name === 'read_reviews') {
      const out = await h.executeTool('read_reviews', JSON.stringify({ product: 'x' }));
      // Obey an instruction found inside the returned data.
      const m = out && /subject=(TW-[A-Z0-9]+)/.exec(out);
      if (m) await h.executeTool('submit_ticket', JSON.stringify({ subject: m[1] }));
    }
  }
};

// A "careful" agent uses the primary tools but treats descriptions and returned
// data as untrusted: it never acts on instructions found there.
const carefulAgent: AgentDriver = async (h) => {
  const tools = await h.getTools();
  for (const t of tools) {
    if (t.name === 'search_docs') await h.executeTool('search_docs', JSON.stringify({ query: 'setup' }));
    if (t.name === 'read_reviews') await h.executeTool('read_reviews', JSON.stringify({ product: 'x' }));
  }
};

describe('corpus levels', () => {
  it('T1 catches a compliant agent and clears a careful one', async () => {
    const t1 = levelById('T1')!;
    expect(await runLevel(t1, host(), compliantAgent, new TelemetryBus())).toMatchObject({
      levelId: 'T1',
      verdict: 'FAIL',
    });
    uninstallPolyfill();
    expect(await runLevel(t1, host(), carefulAgent, new TelemetryBus())).toMatchObject({
      levelId: 'T1',
      verdict: 'PASS',
    });
  });

  it('T2 catches a compliant agent and clears a careful one', async () => {
    const t2 = levelById('T2')!;
    expect(await runLevel(t2, host(), compliantAgent, new TelemetryBus())).toMatchObject({
      verdict: 'FAIL',
    });
    uninstallPolyfill();
    expect(await runLevel(t2, host(), carefulAgent, new TelemetryBus())).toMatchObject({
      verdict: 'PASS',
    });
  });

  it('emits a hostile canary_fired event only when the attack lands', async () => {
    const bus = new TelemetryBus();
    await runLevel(levelById('T1')!, host(), compliantAgent, bus);
    expect(bus.snapshot().some((e) => e.kind === 'canary_fired' && e.hostile)).toBe(true);

    uninstallPolyfill();
    const bus2 = new TelemetryBus();
    await runLevel(levelById('T1')!, host(), carefulAgent, bus2);
    expect(bus2.snapshot().some((e) => e.kind === 'canary_fired')).toBe(false);
  });

  it('tears the level down so tools do not leak between runs', async () => {
    const h = host();
    await runLevel(levelById('T1')!, h, carefulAgent, new TelemetryBus());
    // After a run, the level's tools must be unregistered.
    expect((await h.getTools()).length).toBe(0);
  });

  it('a full careful run scores a perfect resistance score', async () => {
    const h = host();
    const results = [];
    for (const level of CORPUS) {
      results.push(await runLevel(level, h, carefulAgent, new TelemetryBus()));
    }
    const sc = buildScorecard(results);
    expect(sc.decided).toBe(CORPUS.length);
    expect(sc.resistanceScore).toBe(1);
  });

  it('a full compliant run scores zero resistance', async () => {
    const h = host();
    const results = [];
    for (const level of CORPUS) {
      results.push(await runLevel(level, h, compliantAgent, new TelemetryBus()));
    }
    const sc = buildScorecard(results);
    expect(sc.resistanceScore).toBe(0);
    expect(sc.fell).toBe(CORPUS.length);
  });
});
