// worker/detector.ts
//
// Server-side proxy to DeepBlocker's deepfake detector (the Modal router). The
// browser never holds the detector key and never calls Modal directly; it posts
// audio here and the Worker forwards it with the X-API-Key secret.
//
// Contract grounded in SimplyDash src/lib/speaker/verifiedCallers.ts:
//   POST {router}/api/v2/analyze  (multipart: audio, codec, source)  X-API-Key
//   -> { band | worst_band, fake_probability, ... }   band in REAL|UNCERTAIN|FAKE
//
// The detector is a scale-to-zero GPU: a cold start can take ~50s. We race a
// hard timeout so a warming container returns a clean "warming" status instead
// of hanging the request. Band discipline mirrors band.ts: the API owns the
// verdict; we never invent a threshold and never coerce UNCERTAIN.

import type { Env } from './types.ts';

const ANALYZE_TIMEOUT_MS = 25_000;
export const MAX_AUDIO_BYTES = 512 * 1024; // ~a few seconds of opus; caps cost + abuse

export type Band = 'REAL' | 'UNCERTAIN' | 'FAKE';

export type DetectorResult =
  | { status: 'ok'; band: Band; fakeProbability: number | null }
  | { status: 'warming' } // cold start exceeded the timeout
  | { status: 'unavailable' }; // detector not configured / errored

// The detector base is provided by env only (a Worker secret). This public repo
// never hardcodes the internal endpoint. No base -> the detector is unavailable.
function routerBase(env: Env): string | null {
  const base = env.DEEPFAKE_ROUTER_URL;
  return base ? base.replace(/\/$/, '') : null;
}

function parseBand(body: unknown): Band {
  const b = body as { band?: unknown; worst_band?: unknown; data?: { worst_band?: unknown } };
  const raw = String(b?.band ?? b?.worst_band ?? b?.data?.worst_band ?? 'UNCERTAIN').toUpperCase();
  return raw === 'REAL' || raw === 'FAKE' ? (raw as Band) : 'UNCERTAIN';
}

function parseFakeProbability(body: unknown): number | null {
  const b = body as { fake_probability?: unknown; data?: { fake_probability?: unknown } };
  if (typeof b?.fake_probability === 'number') return b.fake_probability;
  if (typeof b?.data?.fake_probability === 'number') return b.data.fake_probability;
  return null;
}

/**
 * Forward an audio blob to the detector. Never throws: every failure maps to a
 * status the caller can render honestly.
 */
export async function analyzeAudio(env: Env, audio: Blob): Promise<DetectorResult> {
  const base = routerBase(env);
  if (!base || !env.DEEPFAKE_API_KEY) return { status: 'unavailable' };
  if (audio.size === 0 || audio.size > MAX_AUDIO_BYTES) return { status: 'unavailable' };

  const form = new FormData();
  form.append('audio', audio, 'sample.webm');
  form.append('codec', 'opus'); // browser mic recordings are webm/opus
  form.append('source', 'openai'); // single-speaker, mono

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);
  try {
    const resp = await fetch(`${base}/api/v2/analyze`, {
      method: 'POST',
      headers: { 'X-API-Key': env.DEEPFAKE_API_KEY },
      body: form,
      signal: controller.signal,
    });
    if (!resp.ok) return { status: 'unavailable' };
    const body = await resp.json().catch(() => null);
    if (!body) return { status: 'unavailable' };
    return { status: 'ok', band: parseBand(body), fakeProbability: parseFakeProbability(body) };
  } catch (err) {
    // Abort = cold-start timeout; render as "warming", not an error.
    if (err instanceof Error && err.name === 'AbortError') return { status: 'warming' };
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

/** Fire-and-forget warm-up ping so the detector container is hot for judges. */
export async function warmDetector(env: Env): Promise<void> {
  const base = routerBase(env);
  if (!base || !env.DEEPFAKE_API_KEY) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    await fetch(`${base}/`, {
      method: 'GET',
      headers: { 'X-API-Key': env.DEEPFAKE_API_KEY },
      signal: controller.signal,
    });
  } catch {
    // Warm-up is best-effort; a failure is never surfaced.
  } finally {
    clearTimeout(timer);
  }
}
