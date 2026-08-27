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

  // Secrets (wrangler secret put) — NEVER in wrangler.toml or the repo.
  SUPABASE_SERVICE_ROLE_KEY: string;
  DEEPFAKE_API_KEY?: string;

  // Bindings.
  RATE_LIMITER?: RateLimiter;
  DAILY?: KVNamespace;
  ASSETS?: Fetcher;
}
