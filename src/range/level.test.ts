import { describe, it, expect, afterEach } from 'vitest';
import { installPolyfill, uninstallPolyfill } from '../webmcp/polyfill.ts';
import { resolveHost } from '../webmcp/shim.ts';
import { TelemetryBus } from './telemetry.ts';
import { runLevel } from './level.ts';
import { CORPUS, levelById } from './levels.ts';
import { buildScorecard } from './scoring.ts';
import { compliantAgent, carefulAgent } from './simAgents.ts';
import type { ModelContextHost } from '../webmcp/types.ts';

afterEach(() => uninstallPolyfill());

function host(): ModelContextHost {
  installPolyfill();
  const h = resolveHost().host;
  if (!h) throw new Error('polyfill not resolved');
  return h;
}

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
