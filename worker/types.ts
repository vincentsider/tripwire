// worker/types.ts
//
// Minimal ambient declarations for the Cloudflare-specific bindings the Worker
// uses. Declaring them here (rather than pulling in @cloudflare/workers-types)
// keeps the Worker typechecking under the same DOM-lib tsconfig as the browser
// code, with no Request/Response/fetch type clashes.

/** Cloudflare Rate Limiting binding (wrangler [[ratelimits]]). */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** A subset of Workers KV, enough for the detector daily-cap counter. */
export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
}

/** Static-assets fetcher binding. */
export interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

/** The slice of ExecutionContext we use. */
export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/** Everything the Worker reads from its environment. Secrets are marked. */
export interface Env {
  // Vars (wrangler [vars]) — not secret.
  SUPABASE_URL: string;
  ALLOWED_ORIGINS?: string; // comma-separated; empty = same-origin only
  DEEPFAKE_ROUTER_URL?: string;
  DETECTOR_DAILY_CAP?: string; // integer as string
  // Mode 2 (badge). Public/non-secret.
  TRIPWIRE_PUBKEY?: string; // Ed25519 public key (spki, base64) — safe to publish
  TRIPWIRE_KEY_ID?: string; // which key signed (default "k1")
  BADGE_TTL_DAYS?: string; // audit expiry, default 90

  // Secrets (wrangler secret put) — NEVER in wrangler.toml or the repo.
  SUPABASE_SERVICE_ROLE_KEY: string;
  DEEPFAKE_API_KEY?: string;
  // Email delivery (optional). Both must be set to actually send a report email;
  // without them, a lead is captured and emailed:false is returned.
  RESEND_API_KEY?: string;
  RESEND_FROM?: string; // e.g. "Tripwire <reports@deepblocker.ai>"
  // Mode 2 signing + admin (secrets).
  ED25519_PRIVATE_KEY?: string; // PKCS8, base64 — signs badges/reports
  ADMIN_TOKEN?: string; // gates POST /api/audit/revoke

  // Bindings.
  RATE_LIMITER?: RateLimiter;
  DAILY?: KVNamespace;
  ASSETS?: Fetcher;
}
