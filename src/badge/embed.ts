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

import { fingerprintSurface } from '../range/fingerprint.ts';
import { decideBadge, type BadgeStateJson, type Tone } from './decide.ts';
import type { RegisteredTool } from '../webmcp/types.ts';

// Capture the script element synchronously — document.currentScript is null after the first await.
const scriptEl = document.currentScript as HTMLScriptElement | null;

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

function render(apiBase: string, origin: string, label: string, tone: Tone, sub: string): void {
  const mount = document.createElement('span');
  const parent = scriptEl?.parentNode ?? document.body;
  parent.insertBefore(mount, scriptEl?.nextSibling ?? null);
  const shadow = mount.attachShadow({ mode: 'open' });
  const color = TONE_COLOR[tone];
  const href = `${apiBase}/api/badge?origin=${encodeURIComponent(origin)}`;
  // Only controlled strings (label/sub from decideBadge, color from a fixed map,
  // href URL-encoded) reach the DOM; the raw origin is never injected as HTML.
  const style =
    '.tw{display:inline-flex;align-items:center;gap:8px;font:500 12px/1.2 ui-sans-serif,system-ui,sans-serif;' +
    'text-decoration:none;border:1px solid ' + color + '33;border-radius:8px;padding:6px 10px;background:#fff;color:#0a0e1a}' +
    '.dot{width:8px;height:8px;border-radius:50%;background:' + color + '}' +
    '.lab{color:' + color + ';font-weight:600}.sub{color:#64748b;font-weight:400}';
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
  const sb = document.createElement('span');
  sb.className = 'sub';
  sb.textContent = sub;
  a.append(dot, lab, sb);
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

  const d = decideBadge(state, liveFingerprint);
  render(apiBase, origin, d.label, d.tone, d.sub);
}

void run();
