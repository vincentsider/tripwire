// src/badge/decide.ts
//
// Pure decision for what the live badge should DISPLAY, given the signed state
// from /api/badge and the fingerprint recomputed from the page's ACTUAL tools
// (or null when this browser has no WebMCP host to read them). Kept pure so the
// honesty rules are unit-tested, not buried in DOM code:
//
//   - never a green "verified" that survives a fingerprint mismatch;
//   - a mismatch reads "tools changed — this seal does not apply";
//   - with no host to check, show the SIGNED state ("audited as of ⟨date⟩"),
//     not a scary error and not a false live-verified.

/** Mirrors the /api/badge JSON (kept local so the embed bundles nothing heavy). */
export type BadgeStateJson =
  | { state: 'unverified' | 'none' }
  | { state: 'revoked'; signedAt?: string }
  | { state: 'expired'; signedAt?: string; fingerprint?: string }
  | {
      state: 'active';
      fingerprint: string;
      assuranceScore: number | null;
      signedAt: string;
    };

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral';

export interface BadgeDisplay {
  label: string;
  tone: Tone;
  sub: string;
}

function day(iso?: string): string {
  return iso ? iso.slice(0, 10) : '';
}

export function decideBadge(state: BadgeStateJson, liveFingerprint: string | null): BadgeDisplay {
  switch (state.state) {
    case 'unverified':
      return { label: 'not verified', tone: 'neutral', sub: 'origin ownership not proven' };
    case 'none':
      return { label: 'not audited', tone: 'neutral', sub: 'no Tripwire audit on record' };
    case 'revoked':
      return { label: 'revoked', tone: 'bad', sub: 'this badge was withdrawn' };
    case 'expired':
      return { label: 'expired', tone: 'warn', sub: 're-audit required' };
    case 'active': {
      const score = state.assuranceScore === null ? '' : ` · ${Math.round(state.assuranceScore * 100)}% clean`;
      if (liveFingerprint === null) {
        // No host to read on-page tools: show the signed state, do not claim a live check.
        return { label: 'tools audited', tone: 'ok', sub: `as of ${day(state.signedAt)}${score}` };
      }
      if (liveFingerprint === state.fingerprint) {
        return { label: 'tools verified', tone: 'ok', sub: `live tools match the audit${score}` };
      }
      return { label: 'tools changed', tone: 'warn', sub: 'the audited tools have changed; this seal does not apply' };
    }
  }
}
