// src/range/fingerprint.ts
//
// The surface fingerprint: a deterministic SHA-256 over a website's WebMCP tool
// set. It is the security anchor of a Mode-2 badge — the signed audit is bound
// to one exact surface, and the live badge recomputes this at use to catch a
// tool-swap or a cloak (honest tools to the auditor, hostile ones to real
// users). It MUST be deterministic across runs and machines, so it does not
// depend on object key order, tool order, or insignificant whitespace.

import type { RegisteredTool } from '../webmcp/types.ts';

/** Canonical per-tool shape that goes into the hash. */
export interface FingerprintTool {
  name: string;
  description: string;
  inputSchema: unknown;
  annotations: unknown;
  origin: string | null;
}

/**
 * Recursively stable-stringify: object keys sorted, array order preserved,
 * primitives as JSON. Deterministic regardless of key insertion order, so the
 * same logical value always serialises to the same bytes.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const s = JSON.stringify(value);
    return s === undefined ? 'null' : s;
  }
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
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
    origin: t.origin ?? null,
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
