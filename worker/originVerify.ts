// worker/originVerify.ts
//
// Domain-control proof for public badges (decision: require origin ownership).
// A site proves it controls an origin by serving a challenge token at a
// well-known path OR publishing it as a DNS TXT record. Both are fetched
// server-side by the Worker; neither can be forged by a party that does not
// control the origin.

import { bytesToBase64 } from './crypto.ts';
import { isBlockedHostname, hostIsPublic } from './netguard.ts';

const FETCH_TIMEOUT_MS = 8000;

/** A fresh, unguessable challenge token. */
export function newChallengeToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const b64url = bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `trustwright-verify-${b64url}`;
}

/** Normalize to a scheme+host(+port) origin, or null if not a valid http(s) origin. */
export function normalizeOrigin(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 2048) return null;
  try {
    const u = new URL(input);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    // SSRF: never accept an internal/loopback origin for an ownership proof —
    // the Worker fetches this origin's /.well-known server-side.
    if (isBlockedHostname(u.hostname)) return null;
    return u.origin; // scheme://host[:port], no path/query/hash
  } catch {
    return null;
  }
}

function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
}

// Tri-state so the maintenance re-check can tell "the site removed the proof"
// (absent) from "the site was momentarily unreachable" (unreachable) and never
// revoke on a transient blip.
export type ProofStatus = 'present' | 'absent' | 'unreachable';

/** Check the well-known file for the token (tri-state). */
export async function probeWellKnown(origin: string, token: string): Promise<ProofStatus> {
  // SSRF layer 2: a name that resolves private (internal host / rebinding) never
  // gets a server-side fetch. Literal internal IPs are already refused upstream
  // by normalizeOrigin, so a proof can only be requested for a public origin.
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return 'unreachable';
  }
  if (!(await hostIsPublic(host))) return 'unreachable';
  const { signal, done } = withTimeout(FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(`${origin}/.well-known/trustwright-challenge.txt`, { redirect: 'manual', signal });
    if (!resp.ok) return resp.status === 404 ? 'absent' : 'unreachable';
    const text = (await resp.text()).slice(0, 4096);
    return text.split(/\s+/).includes(token) ? 'present' : 'absent';
  } catch {
    return 'unreachable';
  } finally {
    done();
  }
}

/** Check a DNS TXT record `_trustwright.<host>` for the token (tri-state). */
export async function probeDnsTxt(origin: string, token: string): Promise<ProofStatus> {
  const { signal, done } = withTimeout(FETCH_TIMEOUT_MS);
  try {
    const host = new URL(origin).host.split(':')[0];
    const resp = await fetch(`https://cloudflare-dns.com/dns-query?name=_trustwright.${host}&type=TXT`, {
      headers: { accept: 'application/dns-json' },
      signal,
    });
    if (!resp.ok) return 'unreachable';
    const j = (await resp.json()) as { Answer?: Array<{ data?: string }> };
    const answers = j.Answer ?? [];
    const present = answers.some((a) => String(a.data ?? '').replace(/"/g, '').split(/\s+/).includes(token));
    return present ? 'present' : 'absent';
  } catch {
    return 'unreachable';
  } finally {
    done();
  }
}

/** Combined tri-state: present if EITHER proof is present; absent only if at least
 *  one channel was definitively reachable-without-the-token and none was present. */
export async function probeControl(origin: string, token: string): Promise<ProofStatus> {
  const wk = await probeWellKnown(origin, token);
  if (wk === 'present') return 'present';
  const dns = await probeDnsTxt(origin, token);
  if (dns === 'present') return 'present';
  return wk === 'absent' || dns === 'absent' ? 'absent' : 'unreachable';
}

/** Boolean wrapper used by the initial confirm flow. */
export async function checkOriginControl(origin: string, token: string): Promise<boolean> {
  return (await probeControl(origin, token)) === 'present';
}
