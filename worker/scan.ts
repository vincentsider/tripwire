// worker/scan.ts
//
// Self-serve URL scan (item 10) + operator audit-from-scan (item 11).
//
// The Worker cannot run a headless browser, so it delegates enumeration to a
// small out-of-band Playwright service (see ../scan/). That service opens the
// URL in a real browser, reads document.modelContext.getTools(), and returns
// the raw surface. The service is UNTRUSTED transport: the Worker re-validates
// the tools and RE-DERIVES the fingerprint + findings itself, exactly as it
// does for an SDK self-report. Two endpoints, two trust levels:
//
//   POST /api/scan            public, best-effort, returns an UNSIGNED preview.
//                             A scan never mints a badge — no ownership proof.
//   POST /api/audit/from-scan admin-gated, signs a scanned surface ONLY for an
//                             already-verified origin (ownership still required).
//
// This keeps the founding rule intact: a signature exists only behind proven
// origin control; everything else is an observation, labelled as such.

import type { Env } from './types.ts';
import { jsonPublic } from './http.ts';
import { checkRate, clientIp } from './limits.ts';
import { validateTools } from './badge.ts';
import { getOrigin, insertAudit } from './audits.ts';
import { signEd25519, keyId, isSigningConfigured } from './crypto.ts';
import { analyzeSurface } from '../src/range/mode2.ts';
import { fingerprintSurface } from '../src/range/fingerprint.ts';
import { buildSurfaceReport, sealSurfaceReport } from '../src/range/surfaceReport.ts';

const MAX_URL_LEN = 2048;
const SCAN_TIMEOUT_MS = 30_000;

/** The shape the scan service returns. `host` says how tools were found. */
export interface ScanServiceResult {
  host: 'native' | 'polyfill' | 'none' | 'error';
  tools?: unknown;
  error?: string;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Validate a scan target into { url, origin }, or null. http(s) only. */
function validateTarget(input: unknown): { url: string; origin: string } | null {
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_URL_LEN) return null;
  try {
    const u = new URL(input);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return { url: u.toString(), origin: u.origin };
  } catch {
    return null;
  }
}

/** Ask the headless service to enumerate the page's WebMCP surface. */
async function fetchScannedSurface(env: Env, url: string): Promise<ScanServiceResult> {
  const base = env.SCAN_SERVICE_URL?.replace(/\/$/, '');
  if (!base) return { host: 'error', error: 'scan_unavailable' };
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), SCAN_TIMEOUT_MS);
  try {
    const resp = await fetch(`${base}/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.SCAN_SERVICE_TOKEN ? { authorization: `Bearer ${env.SCAN_SERVICE_TOKEN}` } : {}),
      },
      body: JSON.stringify({ url }),
      signal: c.signal,
    });
    if (!resp.ok) return { host: 'error', error: `scan_http_${resp.status}` };
    const body = (await resp.json()) as ScanServiceResult;
    if (!body || typeof body.host !== 'string') return { host: 'error', error: 'scan_bad_response' };
    return body;
  } catch {
    return { host: 'error', error: 'scan_unreachable' };
  } finally {
    clearTimeout(t);
  }
}

const SCAN_NOTE =
  'External scan: enumerated from an out-of-band headless browser, limited to what an unauthenticated visitor can see. ' +
  'This is NOT a verified badge — heuristic findings are indicative only, and a signed badge requires proven origin control.';

/** POST /api/scan { url } -> unsigned external preview of a page's tool surface. */
export async function handleScan(req: Request, env: Env): Promise<Response> {
  if (!(await checkRate(env, `${clientIp(req)}:scan`))) {
    return jsonPublic({ error: 'rate_limited' }, { status: 429, req });
  }
  if (!env.SCAN_SERVICE_URL) return jsonPublic({ error: 'scan_unavailable' }, { status: 503, req });

  const body = await readJsonSmall(req);
  const target = validateTarget((body as { url?: unknown })?.url);
  if (!target) return jsonPublic({ error: 'invalid url' }, { status: 400, req });

  const scan = await fetchScannedSurface(env, target.url);
  if (scan.host === 'error') {
    return jsonPublic({ error: scan.error ?? 'scan_failed' }, { status: 502, req });
  }
  const scannedAt = new Date().toISOString();
  if (scan.host === 'none') {
    return jsonPublic(
      { url: target.url, origin: target.origin, host: 'none', tools: 0, findings: [], signed: false, scannedAt, note: 'No WebMCP host was found at this URL.' },
      { req },
    );
  }

  const tools = validateTools(scan.tools);
  if (!tools) return jsonPublic({ error: 'scan_bad_surface' }, { status: 502, req });

  // Untrusted transport: re-derive everything the Worker would sign, but do NOT
  // sign and do NOT persist. A scan yields an observation, never a credential.
  const fingerprint = await fingerprintSurface(tools);
  const audit = await analyzeSurface(tools, { origin: target.origin });
  const report = buildSurfaceReport(audit, fingerprint, target.origin, scannedAt, 0);

  return jsonPublic(
    {
      url: target.url,
      origin: target.origin,
      host: scan.host,
      tools: tools.length,
      fingerprint,
      findings: report.findings,
      assuranceScore: report.assuranceScore,
      signed: false,
      scannedAt,
      note: SCAN_NOTE,
    },
    { req },
  );
}

/** POST /api/audit/from-scan { url } -> admin-gated signed audit of a scanned,
 *  already-verified origin. The operator path for customer zero (item 11). */
export async function handleAuditFromScan(req: Request, env: Env): Promise<Response> {
  const provided = req.headers.get('x-admin-token') ?? '';
  if (!env.ADMIN_TOKEN || !timingSafeEqual(provided, env.ADMIN_TOKEN)) {
    return jsonPublic({ error: 'forbidden' }, { status: 403, req });
  }
  if (!isSigningConfigured(env)) return jsonPublic({ error: 'signing_unavailable' }, { status: 503, req });
  if (!env.SCAN_SERVICE_URL) return jsonPublic({ error: 'scan_unavailable' }, { status: 503, req });

  const body = await readJsonSmall(req);
  const target = validateTarget((body as { url?: unknown })?.url);
  if (!target) return jsonPublic({ error: 'invalid url' }, { status: 400, req });

  // Ownership is still mandatory to SIGN: the scanned origin must be verified.
  const o = await getOrigin(env, target.origin);
  if (!o || !o.verified_at) {
    return jsonPublic({ error: 'origin not verified — complete /api/verify-origin first' }, { status: 403, req });
  }

  const scan = await fetchScannedSurface(env, target.url);
  if (scan.host === 'error') return jsonPublic({ error: scan.error ?? 'scan_failed' }, { status: 502, req });
  if (scan.host === 'none') return jsonPublic({ error: 'no_webmcp_host' }, { status: 422, req });
  const tools = validateTools(scan.tools);
  if (!tools) return jsonPublic({ error: 'scan_bad_surface' }, { status: 502, req });

  const fingerprint = await fingerprintSurface(tools);
  const audit = await analyzeSurface(tools, { origin: target.origin });
  const ttlDays = Number(env.BADGE_TTL_DAYS ?? '90');
  const expiresAt = new Date(Date.now() + (Number.isFinite(ttlDays) ? ttlDays : 90) * 86_400_000).toISOString();
  const report = buildSurfaceReport(audit, fingerprint, target.origin, new Date().toISOString(), 0);
  const sealed = await sealSurfaceReport(report);
  const signature = await signEd25519(env, sealed.canonical);

  try {
    await insertAudit(env, {
      origin: target.origin,
      fingerprint,
      findings: report.findings,
      assurance_score: report.assuranceScore,
      assurance_rung: report.assuranceRung,
      report_sha256: sealed.sha256,
      signature,
      key_id: keyId(env),
      expires_at: expiresAt,
    });
  } catch {
    return jsonPublic({ error: 'persist_failed' }, { status: 502, req });
  }

  return jsonPublic(
    { origin: target.origin, source: 'scan', host: scan.host, report: sealed.report, sha256: sealed.sha256, signature, keyId: keyId(env), expiresAt },
    { req },
  );
}

const MAX_BODY_BYTES = 8 * 1024;
async function readJsonSmall(req: Request): Promise<unknown> {
  const len = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(len) && len > MAX_BODY_BYTES) return undefined;
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}
