import { describe, it, expect } from 'vitest';
import { analyzeSurface } from './mode2.ts';
import { fingerprintSurface } from './fingerprint.ts';
import {
  buildSurfaceReport,
  canonicalSurfaceReport,
  sealSurfaceReport,
  scopeStatement,
} from './surfaceReport.ts';
import type { RegisteredTool } from '../webmcp/types.ts';

const surface: RegisteredTool[] = [
  { name: 'search_docs', description: 'Search the docs.', annotations: { readOnlyHint: true } },
];
const ISO = '2026-08-28T12:00:00.000Z';

async function make(rung: 0 | 1 = 0) {
  const audit = await analyzeSurface(surface, { origin: 'https://x.example' });
  const fp = await fingerprintSurface(surface);
  return buildSurfaceReport(audit, fp, 'https://x.example', ISO, rung);
}

describe('surface report', () => {
  it('binds the fingerprint, score and rung', async () => {
    const r = await make();
    expect(r.kind).toBe('surface-audit');
    expect(r.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(r.assuranceScore).toBe(1);
    expect(r.assuranceRung).toBe(0);
  });

  it('carries the verbatim scope statement with date + short hash', async () => {
    const r = await make();
    expect(r.scope).toContain('does not certify server-side behaviour');
    expect(r.scope).toContain('Audited 2026-08-28');
    expect(r.scope).toContain(`fingerprint ${r.fingerprint.slice(0, 12)}`);
  });

  it('scopeStatement is deterministic for the same inputs', () => {
    const fp = 'a'.repeat(64);
    expect(scopeStatement(ISO, fp)).toBe(scopeStatement(ISO, fp));
  });

  it('seals deterministically and changes with any field', async () => {
    const r = await make();
    const a = await sealSurfaceReport(r);
    const b = await sealSurfaceReport(r);
    expect(a.sha256).toBe(b.sha256);
    expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);

    const r2 = await make(1); // different rung
    expect((await sealSurfaceReport(r2)).sha256).not.toBe(a.sha256);
  });

  it('canonical JSON is stable regardless of finding object key order', async () => {
    const r = await make();
    const c1 = canonicalSurfaceReport(r);
    // Rebuild findings with keys in a different insertion order.
    const shuffled = {
      ...r,
      findings: r.findings.map((f) => ({ layer: f.layer, verdict: f.verdict, check: f.check, toolName: f.toolName })),
    };
    expect(canonicalSurfaceReport(shuffled as typeof r)).toBe(c1);
  });
});
