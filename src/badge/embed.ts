// src/badge/embed.ts
//
// The live, self-verifying Tripwire badge. A site embeds:
//
//   <script src="https://tripwire.../badge.js" data-origin="https://site.com"></script>
//
// It runs ON the site's page (same-origin execution, so it can read the page's
// actual WebMCP tools), fetches the signed badge state, recomputes the surface
// fingerprint from the tools present RIGHT NOW, and renders a verdict in a shadow
// DOM. A tool-swap or cloak shows "tools changed", never a green seal. It never
// verifies against a dev polyfill — only a native host counts as a live check.
//
// Presentation + placement are customisable via data-attributes, but the
// VERDICT is not:
//   data-theme   "light" (default) | "dark" | "auto" (follow prefers-color-scheme)
//   data-variant "default" (dot + label + sub) | "compact" (dot + label only)
//   data-mount   CSS selector of an element to render INTO (default: right after
//                this <script>). Use it to place the badge inside a full-screen
//                app's own chrome — e.g. a fixed corner div.
// The tone/label always come from decideBadge, so a site can restyle or reposition
// the badge but can never make it claim more than the signed, live-checked state.

import { fingerprintSurface } from '../range/fingerprint.ts';
import { decideBadge, type BadgeStateJson, type Tone } from './decide.ts';
import type { RegisteredTool } from '../webmcp/types.ts';

// Capture the script element synchronously — document.currentScript is null after
// the first await. Fall back to finding our own tag by src, so frameworks that
// inject the script dynamically (next/script, etc.) still resolve the API origin
// and options instead of mistaking the host page for the API.
const scriptEl =
  (document.currentScript as HTMLScriptElement | null) ??
  (document.querySelector('script[src*="/badge.js"]') as HTMLScriptElement | null);

const TONE_COLOR: Record<Tone, string> = {
  ok: '#0891b2',
  warn: '#b45309',
  bad: '#be123c',
  neutral: '#475569',
};

function nativeHost(): { getTools(): Promise<RegisteredTool[]> } | null {
  const d = (document as unknown as { modelContext?: { getTools?: unknown } }).modelContext;
  if (d && typeof d.getTools === 'function') return d as { getTools(): Promise<RegisteredTool[]> };
  const n = (navigator as unknown as { modelContext?: { getTools?: unknown } }).modelContext;
  if (n && typeof n.getTools === 'function') return n as { getTools(): Promise<RegisteredTool[]> };
  return null;
}

type Theme = 'light' | 'dark' | 'auto';

function themeVars(theme: Theme): string {
  // Palette pairs: [background, primary text, muted sub, border-alpha].
  const light = '--tw-bg:#fff;--tw-fg:#0a0e1a;--tw-sub:#64748b';
  const dark = '--tw-bg:#0d121c;--tw-fg:#f2f6fc;--tw-sub:#94a3b8';
  if (theme === 'dark') return `:host{${dark}}`;
  if (theme === 'auto') return `:host{${light}}@media (prefers-color-scheme:dark){:host{${dark}}}`;
  return `:host{${light}}`;
}

/**
 * Where to mount the badge. By default it inserts right after the <script> tag
 * (so on a normal page it lands where you paste the line). With data-mount="<css
 * selector>" it renders INTO the element you name instead — the way to place it
 * inside a full-screen app's own HTML chrome (a fixed corner, a nav bar, a
 * panel). The selector is the owner's own attribute; we querySelector it and
 * append a node — never inject it as HTML.
 */
function waitForElement(sel: string, timeoutMs: number): Promise<Element | null> {
  let first: Element | null = null;
  try {
    first = document.querySelector(sel);
  } catch {
    return Promise.resolve(null); // invalid selector
  }
  if (first) return Promise.resolve(first);
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const iv = setInterval(() => {
      const el = document.querySelector(sel);
      if (el || Date.now() > deadline) {
        clearInterval(iv);
        resolve(el);
      }
    }, 200);
  });
}

async function resolveMount(): Promise<{ parent: Node; before: Node | null }> {
  const sel = scriptEl?.dataset.mount;
  if (sel) {
    const el = await waitForElement(sel, 6000);
    if (el) return { parent: el, before: null };
  }
  return { parent: scriptEl?.parentNode ?? document.body, before: scriptEl?.nextSibling ?? null };
}

function render(
  target: { parent: Node; before: Node | null },
  apiBase: string,
  origin: string,
  label: string,
  tone: Tone,
  sub: string,
  opts: { theme: Theme; compact: boolean },
): void {
  const mount = document.createElement('span');
  target.parent.insertBefore(mount, target.before);
  const shadow = mount.attachShadow({ mode: 'open' });
  const color = TONE_COLOR[tone];
  const href = `${apiBase}/api/badge?origin=${encodeURIComponent(origin)}`;
  // Only controlled strings (label/sub from decideBadge, color from a fixed map,
  // href URL-encoded) reach the DOM; the raw origin is never injected as HTML.
  const style =
    themeVars(opts.theme) +
    '.tw{display:inline-flex;align-items:center;gap:8px;font:500 12px/1.2 ui-sans-serif,system-ui,sans-serif;' +
    'text-decoration:none;border:1px solid ' + color + '33;border-radius:8px;padding:6px 10px;' +
    'background:var(--tw-bg);color:var(--tw-fg)}' +
    '.dot{width:8px;height:8px;border-radius:50%;background:' + color + ';flex:none}' +
    '.lab{color:' + color + ';font-weight:600}.sub{color:var(--tw-sub);font-weight:400}';
  const styleEl = document.createElement('style');
  styleEl.textContent = style;
  const a = document.createElement('a');
  a.className = 'tw';
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  const dot = document.createElement('span');
  dot.className = 'dot';
  const lab = document.createElement('span');
  lab.className = 'lab';
  lab.textContent = 'Tripwire: ' + label;
  a.append(dot, lab);
  if (!opts.compact && sub) {
    const sb = document.createElement('span');
    sb.className = 'sub';
    sb.textContent = sub;
    a.append(sb);
  }
  shadow.append(styleEl, a);
}

async function run(): Promise<void> {
  const origin = scriptEl?.dataset.origin;
  if (!origin) return;
  const apiBase = scriptEl?.dataset.api || (scriptEl?.src ? new URL(scriptEl.src).origin : location.origin);

  let state: BadgeStateJson;
  try {
    const resp = await fetch(`${apiBase}/api/badge?origin=${encodeURIComponent(origin)}`);
    if (!resp.ok) return;
    state = (await resp.json()) as BadgeStateJson;
  } catch {
    return;
  }

  let liveFingerprint: string | null = null;
  const host = nativeHost();
  if (host) {
    try {
      liveFingerprint = await fingerprintSurface(await host.getTools());
    } catch {
      liveFingerprint = null;
    }
  }

  const themeAttr = scriptEl?.dataset.theme;
  const theme: Theme = themeAttr === 'dark' || themeAttr === 'auto' ? themeAttr : 'light';
  const compact = scriptEl?.dataset.variant === 'compact';

  const d = decideBadge(state, liveFingerprint);
  const target = await resolveMount();
  render(target, apiBase, origin, d.label, d.tone, d.sub, { theme, compact });
}

// Parity self-test hook (Bug 2). ONLY when the embed is loaded with an explicit
// data-selftest="1" — never on a real badge embed — expose the fingerprint fn so
// a post-deploy check can prove THIS deployed badge.js agrees with the worker on
// the golden surface. Guarded this tightly, it adds nothing to a customer page
// and never fetches or renders. Real embeds fall through to run().
if (scriptEl?.dataset.selftest === '1') {
  (window as unknown as { __tripwireFingerprint?: typeof fingerprintSurface }).__tripwireFingerprint =
    fingerprintSurface;
} else {
  void run();
}
