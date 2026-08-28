// scan/src/server.ts
//
// The Tripwire headless scan service. A tiny HTTP server that opens a URL in a
// real (headless) browser, reads its WebMCP tool surface, and returns it. The
// Tripwire Worker calls this out-of-band because a Cloudflare Worker cannot run
// a browser. This service is UNTRUSTED by the Worker: it only observes; the
// Worker re-validates and re-derives everything it signs.
//
// Design for a long-lived container:
//   * ONE Chromium, launched once and reused (cheap per-request contexts).
//   * A fresh incognito context+page per request, always torn down in finally
//     (no state or memory leaks across scans).
//   * A concurrency semaphore (SCAN_CONCURRENCY) so a burst can't exhaust RAM.
//   * Heavy resources (images/media/fonts) aborted — we only need the DOM+JS.
//   * Hard navigation + enumeration timeouts.
//
// Env:
//   PORT                 (default 8080)
//   SCAN_SERVICE_TOKEN   if set, require `Authorization: Bearer <token>`
//   SCAN_CONCURRENCY     max simultaneous scans (default 2)
//   SCAN_WAIT_MS         how long to poll the page for a host (default 8000)
//   SCAN_NAV_TIMEOUT_MS  navigation timeout (default 15000)

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { chromium, type Browser } from 'playwright';
import { enumerateInPage, normalizeSurface, type RawScan } from './enumerate.js';

const PORT = Number(process.env.PORT ?? '8080');
const TOKEN = process.env.SCAN_SERVICE_TOKEN ?? '';
const CONCURRENCY = Math.max(1, Number(process.env.SCAN_CONCURRENCY ?? '2') || 2);
const WAIT_MS = Math.max(1000, Number(process.env.SCAN_WAIT_MS ?? '8000') || 8000);
const NAV_TIMEOUT_MS = Math.max(3000, Number(process.env.SCAN_NAV_TIMEOUT_MS ?? '15000') || 15000);
const MAX_BODY = 8 * 1024;
const BLOCK = new Set(['image', 'media', 'font']);

let browserPromise: Promise<Browser> | null = null;
/** Lazily launch and memoise the browser; relaunch if it disconnected. */
async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b && b.isConnected()) return b;
    browserPromise = null;
  }
  browserPromise = chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  return browserPromise;
}

// Minimal counting semaphore.
let active = 0;
const waiters: Array<() => void> = [];
function acquire(): Promise<void> {
  if (active < CONCURRENCY) {
    active++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiters.push(resolve));
}
function release(): void {
  active--;
  const next = waiters.shift();
  if (next) {
    active++;
    next();
  }
}

async function scan(url: string): Promise<{ host: string; tools: unknown[]; error?: string }> {
  const browser = await getBrowser();
  const context = await browser.newContext({ javaScriptEnabled: true, bypassCSP: false });
  try {
    // Drop heavy subresources to cut memory + latency; keep documents/scripts.
    await context.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (BLOCK.has(type)) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    } catch {
      return { host: 'error', tools: [], error: 'nav_failed' };
    }
    const raw = (await page.evaluate(enumerateInPage, WAIT_MS)) as RawScan;
    const { host, tools } = normalizeSurface(raw);
    return { host, tools };
  } catch {
    return { host: 'error', tools: [], error: 'scan_failed' };
  } finally {
    // Closing the context frees the page, its JS heap, and all listeners.
    await context.close().catch(() => {});
  }
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const s = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(s) });
  res.end(s);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    let over = false;
    req.on('data', (chunk: Buffer) => {
      if (over) return;
      data += chunk;
      if (data.length > MAX_BODY) {
        over = true;
        reject(new Error('body_too_large'));
        req.destroy();
      }
    });
    req.on('end', () => !over && resolve(data));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, active, concurrency: CONCURRENCY });
  if (req.method !== 'POST' || (req.url ?? '').split('?')[0] !== '/scan') return send(res, 404, { error: 'not_found' });

  if (TOKEN) {
    const auth = req.headers['authorization'] ?? '';
    if (auth !== `Bearer ${TOKEN}`) return send(res, 401, { error: 'unauthorized' });
  }

  let url: string;
  try {
    const parsed = JSON.parse(await readBody(req)) as { url?: unknown };
    if (typeof parsed.url !== 'string' || parsed.url.length > 2048) return send(res, 400, { error: 'invalid_url' });
    const u = new URL(parsed.url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return send(res, 400, { error: 'invalid_url' });
    url = u.toString();
  } catch {
    return send(res, 400, { error: 'invalid_body' });
  }

  await acquire();
  try {
    const result = await scan(url);
    send(res, result.host === 'error' ? 502 : 200, result);
  } catch {
    send(res, 500, { host: 'error', tools: [], error: 'internal' });
  } finally {
    release();
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[tripwire-scan] listening on :${PORT} (concurrency=${CONCURRENCY}, wait=${WAIT_MS}ms)`);
});

async function shutdown(): Promise<void> {
  server.close();
  const b = await browserPromise?.catch(() => null);
  await b?.close().catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
