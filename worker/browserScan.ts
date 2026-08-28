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
  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch(worker);
    return await withDeadline(runScan(browser, url), HARD_CAP_MS, { host: 'error', tools: [], error: 'scan_timeout' });
  } catch {
    return { host: 'error', tools: [], error: 'scan_failed' };
  } finally {
    // Always release the browser session — leaking one exhausts the account cap.
    try {
      await browser?.close();
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

    // Drop heavy subresources: we only need the document + its scripts.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (BLOCK.has(req.resourceType())) void req.abort();
      else void req.continue();
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
