// src/range/fingerprint.ts
//
// The surface fingerprint: a deterministic SHA-256 over a website's WebMCP tool
// set. It is the security anchor of a Mode-2 badge — the signed audit is bound
// to one exact surface, and the live badge recomputes this at use to catch a
// tool-swap or a cloak (honest tools to the auditor, hostile ones to real
// users). It MUST be deterministic across runs and machines, so it does not
// depend on object key order, tool order, or insignificant whitespace.

import type { RegisteredTool } from '../webmcp/types.ts';

/** Canonical per-tool shape that goes into the hash.
 *
 * DELIBERATELY EXCLUDED: anything a HOST stamps onto a tool after registration
 * — `origin`, `title`, `window`, and any other environment decoration. Chrome's
 * native WebMCP host adds these; the polyfill does not. If they entered the
 * hash, the same tools would fingerprint differently per browser, and no badge
 * could ever verify for a native-host visitor (found in the field by customer
 * zero, openclawcity.ai). Only what the SITE declared at registration counts. */
export interface FingerprintTool {
  name: string;
  description: string;
  inputSchema: unknown;
  annotations: unknown;
}

/**
 * Recursively stable-stringify: object keys sorted, array order preserved,
 * primitives as JSON. Deterministic regardless of key insertion order, so the
 * same logical value always serialises to the same bytes.
 */
export function stableStringify(value: unknown, seen?: WeakSet<object>): string {
  if (value === null || typeof value !== 'object') {
    const s = JSON.stringify(value);
    return s === undefined ? 'null' : s;
  }
  // Circular guard, PATH-SCOPED: a native host can stamp self-referential
  // objects (e.g. a window) into tool structures. We break only true cycles —
  // an object that is its own ancestor — by tracking the current descent path
  // and removing each node on the way back up. A shared sub-object that appears
  // in two SIBLING branches (a DAG, not a cycle) is therefore serialised in
  // full both times, so the hash depends only on structure, never on whether
  // the host happened to share a reference. Mint and verify read the tools
  // independently and may share references differently; path-scoping keeps them
  // identical where a visited-ever set would not.
  const track = seen ?? new WeakSet<object>();
  if (track.has(value as object)) return '"[circular]"';
  track.add(value as object);
  let out: string;
  if (Array.isArray(value)) {
    out = '[' + value.map((v) => stableStringify(v, track)).join(',') + ']';
  } else {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    out = '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k], track)).join(',') + '}';
  }
  track.delete(value as object);
  return out;
}

/** Collapse whitespace runs and trim, so cosmetic spacing does not change the hash. */
function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Map RegisteredTools to the canonical fingerprint shape (nulls for absent fields). */
export function toFingerprintTools(tools: ReadonlyArray<RegisteredTool>): FingerprintTool[] {
  return tools.map((t) => ({
    name: t.name,
    description: normalizeWhitespace(t.description ?? ''),
    inputSchema: t.inputSchema ?? null,
    annotations: t.annotations ?? null,
  }));
}

/**
 * Canonical string form of a surface: tools sorted by name (then by full
 * canonical form as a tiebreak, so even a malformed duplicate-name surface is
 * deterministic), each with stably-ordered nested keys.
 */
export function canonicalSurface(tools: ReadonlyArray<RegisteredTool>): string {
  const norm = toFingerprintTools(tools).map((t) => ({ t, s: stableStringify(t) }));
  norm.sort((a, b) => {
    if (a.t.name !== b.t.name) return a.t.name < b.t.name ? -1 : 1;
    return a.s < b.s ? -1 : a.s > b.s ? 1 : 0;
  });
  return '[' + norm.map((x) => x.s).join(',') + ']';
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/**
 * SHA-256 fingerprint of a tool surface, as lowercase hex. Deterministic.
 * Throws if Web Crypto is unavailable rather than returning a fake digest — a
 * fingerprint that cannot be trusted must never masquerade as one.
 */
export async function fingerprintSurface(tools: ReadonlyArray<RegisteredTool>): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto (crypto.subtle) is required to compute a surface fingerprint');
  const canonical = canonicalSurface(tools);
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return toHex(digest);
}

// --- Drift tripwire (Bug 2) -----------------------------------------------
//
// The worker (mint + scan) and the browser badge.js both import THIS module,
// so they can only ever disagree if one was built/deployed from a stale tree.
// These three constants are the single source of truth a build-time test AND a
// live worker endpoint (/api/fingerprint-selftest) both assert against. If the
// deployed worker returns anything but FINGERPRINT_GOLDEN_HASH, the two bundles
// have drifted — exactly the silent failure customer zero hit.
//
// Bump FINGERPRINT_ALGO and refresh the golden hash IN THE SAME COMMIT whenever
// you change the canonical form on purpose, then rebuild and redeploy the
// worker and badge.js TOGETHER (`npm run deploy`, never a bare `wrangler deploy`).

/** Canonical-form version. Changes here are deliberate, versioned events. */
export const FINGERPRINT_ALGO = 'sha256/v2-no-host-decoration';

/** A fixed reference surface whose fingerprint is pinned below. */
export const FINGERPRINT_GOLDEN_SURFACE: RegisteredTool[] = [
  {
    name: 'search_articles',
    description: 'Search published articles by keyword.',
    inputSchema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'post_comment',
    description: 'Post a comment on an article.',
    inputSchema: { type: 'object', properties: { body: { type: 'string' } }, required: ['body'] },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
  },
];

/** Expected fingerprint of FINGERPRINT_GOLDEN_SURFACE under the current algo. */
export const FINGERPRINT_GOLDEN_HASH = 'e7dc8eab2b7ee0b120cabb3e3ded3f6423a67ccb4d0de1e996b31640c500761b';
