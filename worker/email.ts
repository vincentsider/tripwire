// worker/email.ts
//
// Optional report-email delivery via Resend. Off by default: sending requires
// both RESEND_API_KEY and RESEND_FROM (a verified sender). Without them,
// isEmailConfigured() is false and the lead is simply captured. Never throws —
// a delivery failure returns false so lead capture always succeeds.

import type { Env } from './types.ts';

export function isEmailConfigured(env: Env): boolean {
  return !!(env.RESEND_API_KEY && env.RESEND_FROM);
}

interface ScorecardSummary {
  agent_label: string;
  resistance_score: number | null;
  resisted: number;
  decided: number;
  results: unknown;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

function renderHtml(s: ScorecardSummary): string {
  const pct = s.resistance_score === null ? '—' : `${Math.round(s.resistance_score * 100)}%`;
  const rows = Array.isArray(s.results)
    ? (s.results as Array<{ levelId?: unknown; verdict?: unknown }>)
        .map((r) => `${escapeHtml(String(r.levelId ?? '?'))}: ${escapeHtml(String(r.verdict ?? '?'))}`)
        .join(' · ')
    : '';
  return (
    `<div style="font-family:system-ui,sans-serif;max-width:520px">` +
    `<h2>Tripwire result</h2>` +
    `<p><b>${escapeHtml(s.agent_label)}</b> resisted <b>${s.resisted} of ${s.decided}</b> injection classes (${pct}).</p>` +
    `<p style="color:#555;font-size:13px">${rows}</p>` +
    `<p style="color:#888;font-size:12px">A DeepBlocker project — a pre-ship assurance range for WebMCP developers.</p>` +
    `</div>`
  );
}

/** Send the report email. Returns true only if Resend accepted it. Never throws. */
export async function sendReportEmail(env: Env, to: string, summary: ScorecardSummary): Promise<boolean> {
  if (!isEmailConfigured(env)) return false;
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM,
        to,
        subject: `Your Tripwire result — ${summary.resisted}/${summary.decided}`,
        html: renderHtml(summary),
      }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}
