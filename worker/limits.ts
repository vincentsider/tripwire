// worker/limits.ts
//
// Two independent throttles:
//   1. checkRate  — Cloudflare Rate Limiting binding, per IP + route, short window.
//   2. underDailyCap — a KV-backed daily ceiling for the paid detector call, so a
//      viral moment cannot become a runaway bill. Fails CLOSED: if KV is not
//      bound, the detector endpoint refuses rather than spends without a ceiling.

import type { Env } from './types.ts';

/** Per-IP-per-route short-window limit. Allows when no limiter is bound. */
export async function checkRate(env: Env, key: string): Promise<boolean> {
  if (!env.RATE_LIMITER) return true;
  try {
    const { success } = await env.RATE_LIMITER.limit({ key });
    return success;
  } catch {
    // A limiter failure must not open the floodgates on a write endpoint.
    return false;
  }
}

/** UTC day key so the ceiling resets at midnight UTC regardless of location. */
function dayKey(name: string): string {
  const d = new Date();
  const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
  return `cap:${name}:${iso}`;
}

/**
 * Soft daily ceiling on a named operation. Best-effort (KV is eventually
 * consistent), which is fine for a cost guardrail. Returns false — refusing the
 * operation — when KV is unavailable, so the detector never runs uncapped.
 */
export async function underDailyCap(env: Env, name: string, cap: number): Promise<boolean> {
  if (!env.DAILY) return false; // fail closed: no ceiling means no spend
  const key = dayKey(name);
  try {
    const current = Number((await env.DAILY.get(key)) ?? '0');
    if (Number.isFinite(current) && current >= cap) return false;
    // Two-day TTL so yesterday's key self-cleans.
    await env.DAILY.put(key, String(current + 1), { expirationTtl: 172800 });
    return true;
  } catch {
    return false;
  }
}

/** Client IP for rate-limit keying. Only the Cloudflare-set CF-Connecting-IP is
 *  trusted; the client-controlled X-Forwarded-For is NOT used (it would let a
 *  caller rotate the rate-limit key at will). Off Cloudflare (local dev) there
 *  is no limiter bound, so the 'unknown' bucket is never actually rate-limited. */
export function clientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') || 'unknown';
}
