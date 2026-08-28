// worker/originVerify.ts
//
// Domain-control proof for public badges (decision: require origin ownership).
// A site proves it controls an origin by serving a challenge token at a
// well-known path OR publishing it as a DNS TXT record. Both are fetched
// server-side by the Worker; neither can be forged by a party that does not
// control the origin.

import { bytesToBase64 } from './crypto.ts';

const FETCH_TIMEOUT_MS = 8000;

/** A fresh, unguessable challenge token. */
export function newChallengeToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const b64url = bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `tripwire-verify-${b64url}`;
}

/** Normalize to a scheme+host(+port) origin, or null if not a valid http(s) origin. */
export function normalizeOrigin(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 2048) return null;
  try {
    const u = new URL(input);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
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

/** Check the well-known file for the token. */
export async function checkWellKnown(origin: string, token: string): Promise<boolean> {
  const { signal, done } = withTimeout(FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(`${origin}/.well-known/tripwire-challenge.txt`, { redirect: 'manual', signal });
    if (!resp.ok) return false;
    const text = (await resp.text()).slice(0, 4096);
    return text.split(/\s+/).includes(token);
  } catch {
    return false;
  } finally {
    done();
  }
}

/** Check a DNS TXT record `_tripwire.<host>` for the token, via DNS-over-HTTPS. */
export async function checkDnsTxt(origin: string, token: string): Promise<boolean> {
  const { signal, done } = withTimeout(FETCH_TIMEOUT_MS);
  try {
    const host = new URL(origin).host.split(':')[0];
    const resp = await fetch(`https://cloudflare-dns.com/dns-query?name=_tripwire.${host}&type=TXT`, {
      headers: { accept: 'application/dns-json' },
      signal,
    });
    if (!resp.ok) return false;
    const j = (await resp.json()) as { Answer?: Array<{ data?: string }> };
    return (j.Answer ?? []).some((a) => String(a.data ?? '').replace(/"/g, '').split(/\s+/).includes(token));
  } catch {
    return false;
  } finally {
    done();
  }
}

/** Verified if EITHER proof is present. */
export async function checkOriginControl(origin: string, token: string): Promise<boolean> {
  if (await checkWellKnown(origin, token)) return true;
  return checkDnsTxt(origin, token);
}
