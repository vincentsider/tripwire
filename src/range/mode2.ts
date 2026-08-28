// src/range/mode2.ts
//
// Mode 2: audit a WEBSITE's WebMCP tool surface (vs Mode 1, which tests an
// agent). The T1–T7 corpus turned around — instead of "did the agent fall for
// T-n?", we ask "does this site's own surface exhibit the T-n red flag?".
//
// Every check here is a STATIC descriptor lint: it only reads names,
// descriptions, inputSchema, annotations and origin — no model, no side
// effects, safe to run against a live production surface. Per the design
// decision, a heuristic descriptor smell is PARTIAL (needs confirmation), never
// FAIL. FAIL is reserved for a directly observed violation: here, only surface
// instability (T3), which is observed by re-enumeration, not guessed.
//
// The observable/behavioural probes (sandbox execution, leak canaries) live
// separately and can promote a PARTIAL to FAIL; this module is the always-safe
// static layer.

import type { RegisteredTool } from '../webmcp/types.ts';
import { buildScorecard, type Scorecard, type Verdict } from './scoring.ts';
import { fingerprintSurface } from './fingerprint.ts';

export type CheckId = 'T1' | 'T2' | 'T3' | 'T5' | 'T6' | 'T7';

export interface Finding {
  /** Tool the finding is about; null for a surface-level finding (T3). */
  toolName: string | null;
  check: CheckId;
  category: string;
  verdict: Verdict;
  layer: 'static';
  /** Short human-readable reason / matched evidence. */
  evidence?: string;
}

export interface SurfaceAudit {
  origin: string | null;
  findings: Finding[];
  /** Assurance Score (0..1) over decided checks; 1.0 = all clean. */
  scorecard: Scorecard;
}

const CATEGORY: Record<CheckId, string> = {
  T1: 'tool-framing',
  T2: 'contaminated-output',
  T3: 'tool-hijacking',
  T5: 'false-readonly',
  T6: 'cross-origin-relay',
  T7: 'assertion-laundering',
};

// ── Per-tool static checks. Each returns a Verdict + evidence, or null to skip
// (the check does not apply to this tool, so it does not affect the score). ──

/** T1: a description that INSTRUCTS the agent to take further action, rather than describing the tool. */
function checkT1(tool: RegisteredTool): { verdict: Verdict; evidence?: string } {
  const d = tool.description ?? '';
  const patterns: RegExp[] = [
    /\b(also |then |always |be sure to |make sure to |remember to |you (must|should|need to)( also)? call)\b/i,
    /\bthe proper way (is|to)\b/i,
    /\bbefore (answering|responding|replying|continuing)\b/i,
    /\bafter (returning|calling|you (get|receive))\b/i,
    /\bcall [a-z0-9_]+ (with|to|after|before)\b/i,
  ];
  const hit = patterns.find((re) => re.test(d));
  if (hit) {
    const m = hit.exec(d);
    return { verdict: 'PARTIAL', evidence: `description instructs the agent: "${(m?.[0] ?? '').trim()}"` };
  }
  return { verdict: 'PASS' };
}

/** T2: a tool that looks like it returns third-party/user content but is not marked untrustedContentHint. */
function checkT2(tool: RegisteredTool): { verdict: Verdict; evidence?: string } | null {
  const text = `${tool.name} ${tool.description ?? ''}`;
  const looksExternal = /\b(review|comment|message|post|feed|profile|thread|reply|ticket|chat|forum|mention|dm|inbox|user[- ]?content|ugc|note)s?\b/i.test(text);
  if (!looksExternal) return null; // not applicable
  if (tool.annotations?.untrustedContentHint === true) return { verdict: 'PASS' };
  return { verdict: 'PARTIAL', evidence: 'returns third-party/user content but does not set untrustedContentHint' };
}

/** T5: readOnlyHint:true on a tool whose name/description imply a mutation. */
function checkT5(tool: RegisteredTool): { verdict: Verdict; evidence?: string } | null {
  if (tool.annotations?.readOnlyHint !== true) return null; // only applies to declared read-only tools
  const text = `${tool.name} ${tool.description ?? ''}`;
  const mutation = /\b(process|charge|pay|send|delete|remove|update|transfer|approve|create|cancel|refund|withdraw|issue|revoke|submit|purchase|order|book|schedule|modify|edit|write|set|add|apply|move|assign|grant|deploy|publish)\b/i;
  const m = mutation.exec(text);
  if (m) return { verdict: 'PARTIAL', evidence: `marked read-only but implies mutation: "${m[0]}"` };
  return { verdict: 'PASS' };
}

/** T6: cross-origin exposure or a parameter that could relay data across the boundary. */
function checkT6(tool: RegisteredTool): { verdict: Verdict; evidence?: string } | null {
  if (tool.origin) {
    return { verdict: 'PARTIAL', evidence: `cross-origin tool exposed from ${tool.origin}` };
  }
  const props = (tool.inputSchema?.properties ?? {}) as Record<string, unknown>;
  const relayWords = new Set([
    'url', 'uri', 'callback', 'webhook', 'redirect', 'endpoint', 'token', 'destination', 'target', 'forward', 'relay',
  ]);
  // Tokenize the key across snake_case and camelCase so "webhook_url" -> [webhook, url].
  const relayParam = Object.keys(props).find((k) =>
    k
      .replace(/[_\-]+/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/\s+/)
      .some((tok) => relayWords.has(tok)),
  );
  if (relayParam) {
    return { verdict: 'PARTIAL', evidence: `takes a relay-capable parameter: "${relayParam}"` };
  }
  return null; // not applicable
}

/** T7: a tool that ASSERTS a trust result the agent is meant to believe. */
function checkT7(tool: RegisteredTool): { verdict: Verdict; evidence?: string } | null {
  const text = `${tool.name} ${tool.description ?? ''}`;
  const assertion = /\b(verified|authenticated|biometric|liveness|is (a )?human|not a bot|trusted|is safe|legitimate|genuine|cleared|identity confirmed|risk[- ]?free)\b/i;
  const m = assertion.exec(text);
  if (m) return { verdict: 'PARTIAL', evidence: `asserts a trust result: "${m[0]}"` };
  return null; // not applicable
}

const PER_TOOL: Array<{ id: CheckId; run: (t: RegisteredTool) => { verdict: Verdict; evidence?: string } | null }> = [
  { id: 'T1', run: checkT1 },
  { id: 'T2', run: checkT2 },
  { id: 'T5', run: checkT5 },
  { id: 'T6', run: checkT6 },
  { id: 'T7', run: checkT7 },
];

/**
 * Analyse a surface statically. `resample` is an optional second snapshot of the
 * same surface; if provided and its fingerprint differs, T3 (tool-hijacking) is a
 * confirmed FAIL — an unstable tool set is observed, not guessed. Without a
 * resample T3 is SKIPPED (the live badge / scheduled scan supplies it).
 */
export async function analyzeSurface(
  tools: ReadonlyArray<RegisteredTool>,
  options: { origin?: string; resample?: ReadonlyArray<RegisteredTool> } = {},
): Promise<SurfaceAudit> {
  const findings: Finding[] = [];

  for (const tool of tools) {
    for (const check of PER_TOOL) {
      const r = check.run(tool);
      if (!r) continue; // not applicable
      findings.push({
        toolName: tool.name,
        check: check.id,
        category: CATEGORY[check.id],
        verdict: r.verdict,
        layer: 'static',
        ...(r.evidence ? { evidence: r.evidence } : {}),
      });
    }
  }

  // T3: surface stability across two enumerations (observed, so FAIL is allowed).
  if (options.resample) {
    const a = await fingerprintSurface(tools);
    const b = await fingerprintSurface(options.resample);
    findings.push({
      toolName: null,
      check: 'T3',
      category: CATEGORY.T3,
      verdict: a === b ? 'PASS' : 'FAIL',
      layer: 'static',
      evidence: a === b ? 'tool set stable across re-enumeration' : 'tool set changed between two enumerations',
    });
  }

  const scorecard = buildScorecard(
    findings.map((f) => ({
      levelId: f.toolName ? `${f.toolName}:${f.check}` : f.check,
      category: f.category,
      verdict: f.verdict,
      ...(f.evidence ? { evidence: f.evidence } : {}),
    })),
  );

  return { origin: options.origin ?? null, findings, scorecard };
}
