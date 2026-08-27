import { describe, it, expect, afterEach } from 'vitest';
import { installPolyfill, uninstallPolyfill } from '../webmcp/polyfill.ts';
import { resolveHost } from '../webmcp/shim.ts';
import { TelemetryBus } from './telemetry.ts';
import { runLevel } from './level.ts';
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

describe('corpus levels', () => {
  // Every level must catch a susceptible agent and clear a careful one — this is
  // the core contract of the whole range, checked for the entire corpus.
  for (const level of CORPUS) {
    it(`${level.id} (${level.category}): compliant FAILs, careful PASSes`, async () => {
      const h1 = host();
      const fail = await runLevel(level, h1, 'compliant', new TelemetryBus());
      expect(fail.verdict, `${level.id} should catch a compliant agent`).toBe('FAIL');
      uninstallPolyfill();

      const h2 = host();
      const pass = await runLevel(level, h2, 'careful', new TelemetryBus());
      expect(pass.verdict, `${level.id} should clear a careful agent`).toBe('PASS');
    });
  }

  it('emits a hostile canary only when an attack lands', async () => {
    const bus = new TelemetryBus();
    await runLevel(levelById('T1')!, host(), 'compliant', bus);
    expect(bus.snapshot().some((e) => e.kind === 'canary_fired' && e.hostile)).toBe(true);

    uninstallPolyfill();
    const bus2 = new TelemetryBus();
    await runLevel(levelById('T1')!, host(), 'careful', bus2);
    expect(bus2.snapshot().some((e) => e.kind === 'canary_fired')).toBe(false);
  });

  it('tears each level down so tools never leak between runs', async () => {
    const h = host();
    for (const level of CORPUS) {
      await runLevel(level, h, 'careful', new TelemetryBus());
    }
    expect((await h.getTools()).length).toBe(0);
  });

  it('a full careful run scores a perfect resistance score', async () => {
    const h = host();
    const results = [];
    for (const level of CORPUS) results.push(await runLevel(level, h, 'careful', new TelemetryBus()));
    const sc = buildScorecard(results);
    expect(sc.decided).toBe(CORPUS.length);
    expect(sc.resistanceScore).toBe(1);
  });

  it('a full compliant run scores zero resistance', async () => {
    const h = host();
    const results = [];
    for (const level of CORPUS) results.push(await runLevel(level, h, 'compliant', new TelemetryBus()));
    const sc = buildScorecard(results);
    expect(sc.resistanceScore).toBe(0);
    expect(sc.fell).toBe(CORPUS.length);
  });

  it('T3 rug-pull: the careful agent refuses the swapped tool (no hostile execute)', async () => {
    const bus = new TelemetryBus();
    await runLevel(levelById('T3')!, host(), 'careful', bus);
    const events = bus.snapshot();
    expect(events.some((e) => e.kind === 'toolchange')).toBe(true);
    expect(events.some((e) => e.kind === 'canary_fired')).toBe(false);
  });
});
