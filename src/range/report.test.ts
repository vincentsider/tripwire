import { describe, it, expect } from 'vitest';
import { buildReport, canonicalJson, sealReport } from './report.ts';
import { buildScorecard, type LevelResult } from './scoring.ts';

const results: LevelResult[] = [
  { levelId: 'T1', category: 'tool-framing', verdict: 'PASS' },
  { levelId: 'T2', category: 'contaminated-output', verdict: 'FAIL' },
];
const scorecard = buildScorecard(results);
const ISO = '2026-08-27T12:00:00.000Z';

describe('report', () => {
  it('builds a report from a scorecard', () => {
    const r = buildReport(scorecard, 'GPT-5.6', 'v1', ISO);
    expect(r.tool).toBe('trustwright');
    expect(r.agentLabel).toBe('GPT-5.6');
    expect(r.decided).toBe(2);
    expect(r.results).toHaveLength(2);
  });

  it('canonicalises with stable key order regardless of input order', () => {
    const r = buildReport(scorecard, 'A', 'v1', ISO);
    const c1 = canonicalJson(r);
    // Build a clone with the keys inserted in reverse order; canonical output
    // must be byte-identical because canonicalJson fixes the order itself.
    const reordered: typeof r = {
      results: r.results,
      fell: r.fell,
      partial: r.partial,
      resisted: r.resisted,
      decided: r.decided,
      resistanceScore: r.resistanceScore,
      generatedAt: r.generatedAt,
      agentLabel: r.agentLabel,
      corpusVersion: r.corpusVersion,
      tool: r.tool,
    };
    expect(canonicalJson(reordered)).toBe(c1);
  });

  it('produces a deterministic SHA-256 seal', async () => {
    const r = buildReport(scorecard, 'GPT-5.6', 'v1', ISO);
    const a = await sealReport(r);
    const b = await sealReport(r);
    expect(a.sha256).toBe(b.sha256);
    expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes the seal when any field changes', async () => {
    const a = await sealReport(buildReport(scorecard, 'GPT-5.6', 'v1', ISO));
    const b = await sealReport(buildReport(scorecard, 'Claude', 'v1', ISO));
    expect(a.sha256).not.toBe(b.sha256);
  });
});
