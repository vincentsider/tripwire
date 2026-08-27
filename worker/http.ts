// worker/http.ts
//
// CORS + JSON response helpers. CORS is allowlist-based: an Origin is reflected
// only if it appears in ALLOWED_ORIGINS. When ALLOWED_ORIGINS is empty the app
// is served same-origin by this Worker and no CORS headers are needed.

import type { Env } from './types.ts';

function allowedOrigins(env: Env): Set<string> {
  return new Set(
    (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/** CORS headers for a request, or {} when the origin is not allowlisted. */
export function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin');
  if (!origin || !allowedOrigins(env).has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Handle a CORS preflight. */
export function preflight(req: Request, env: Env): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req, env) });
}

/** JSON response with CORS + no-store (these endpoints are never cacheable). */
export function json(
  data: unknown,
  init: { status?: number; req: Request; env: Env },
): Response {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(init.req, init.env),
    },
  });
}
