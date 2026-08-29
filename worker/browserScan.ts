// worker/browserScan.ts
//
// The scan engine, running INSIDE the Worker via Cloudflare Browser Rendering.
// A managed headless Chromium (the `BROWSER` binding) opens the target URL, the
// page's own JavaScript runs, and we read whatever WebMCP host it exposes. No
// separate server to host or scale — Cloudflare runs the browser.
//
// This is still an OBSERVER: it copies declared tool descriptors only, never
// executes a tool, and the caller (worker/scan.ts) re-validates and re-derives
// everything before it signs anything. A scan yields an observation, never a
// credential.

import puppeteer, { type Browser } from '@cloudflare/puppeteer';
import type { Env } from './types.ts';
import { enumerateInPage, normalizeSurface, type NormalTool, type ScanHost } from '../src/scan/enumerate.ts';
import { isBlockedHostname, hostIsPublic } from './netguard.ts';

const WAIT_MS = 8000; // how long the in-page poll waits for a host to appear
const NAV_TIMEOUT_MS = 15000; // navigation ceiling
const HARD_CAP_MS = 25000; // absolute ceiling for the whole scan
const BLOCK = new Set(['image', 'media', 'font']); // heavy subresources we don't need

export interface BrowserScanResult {
  host: ScanHost | 'error';
  tools: NormalTool[];
  error?: string;
}

function withDeadline<T>(p: Promise<T>, ms: number, onTimeout: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const t = setTimeout(() => resolve(onTimeout), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(onTimeout);
      },
    );
  });
}

/** Open `url` in the managed browser and return its normalized WebMCP surface. */
export async function scanWithBrowser(env: Env, url: string): Promise<BrowserScanResult> {
  const worker = env.BROWSER;
  if (!worker) return { host: 'error', tools: [], error: 'scan_unavailable' };
  // SSRF layer 2: block a DNS name that resolves to a private address (an
  // internal hostname, or a rebinding record) before spending a browser session.
  let targetHost: string;
  try {
    targetHost = new URL(url).hostname;
  } catch {
    return { host: 'error', tools: [], error: 'invalid_url' };
  }
  if (!(await hostIsPublic(targetHost))) return { host: 'error', tools: [], error: 'blocked_host' };
  // Holder (not a bare `let`) so control-flow analysis keeps the Browser|null type
  // in `finally` even though the handle is assigned inside the launch callback.
  const held: { browser: Browser | null } = { browser: null };
  let abandoned = false;
  try {
    // The deadline now covers launch AND scan (launch was previously unbounded —
    // a stalled launch escaped the ceiling and could orphan a half-open session).
    // If we give up before launch resolves, the .then still reclaims the session
    // the moment it arrives, so nothing leaks on the account's concurrent cap.
    const launchP = puppeteer.launch(worker).then((b) => {
      held.browser = b;
      if (abandoned) void b.close().catch(() => {});
      return b;
    });
    return await withDeadline(
      launchP.then((b) => runScan(b, url)),
      HARD_CAP_MS,
      { host: 'error', tools: [], error: 'scan_timeout' },
    );
  } catch {
    return { host: 'error', tools: [], error: 'scan_failed' };
  } finally {
    // Always release the browser session — leaking one exhausts the account cap.
    abandoned = true;
    try {
      await held.browser?.close();
    } catch {
      /* already gone */
    }
  }
}

/** Never throws: any failure resolves to a host:'error' result. */
async function runScan(browser: Browser, url: string): Promise<BrowserScanResult> {
  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    // Drop heavy subresources, and — the SSRF redirect defense — abort any
    // request whose host is internal. A 30x from a public page to a literal
    // private IP is caught synchronously here; a document/frame navigation to a
    // NAME that resolves private is caught by hostIsPublic. Everything else only
    // gets the cheap literal check so a sub-resource can't be redirected inward.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      void (async () => {
        try {
          let host = '';
          try {
            host = new URL(req.url()).hostname;
          } catch {
            /* data:/about:/blob: — no host to police */
          }
          if (host) {
            // resourceType()'s declared union is incomplete; CDP emits
            // 'document' for a top-level/frame navigation at runtime. Compare as
            // a string so a redirect target gets the full async host check.
            const type = String(req.resourceType());
            const isNavigation = type === 'document' || type === 'sub_frame';
            const internal = isNavigation ? !(await hostIsPublic(host)) : isBlockedHostname(host);
            if (internal) return void req.abort();
          }
          if (BLOCK.has(req.resourceType())) return void req.abort();
          void req.continue();
        } catch {
          /* request already handled/torn down */
        }
      })();
    });

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    } catch {
      return { host: 'error', tools: [], error: 'nav_failed' };
    }

    const raw = await page.evaluate(enumerateInPage, WAIT_MS);
    return normalizeSurface(raw);
  } catch {
    return { host: 'error', tools: [], error: 'scan_failed' };
  }
}
