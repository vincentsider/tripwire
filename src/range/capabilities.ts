// src/range/capabilities.ts
//
// The closed registry of ENGINE-OWNED capabilities an AttackSpec may reference
// by name. This is how a data-driven level performs an external effect (e.g. the
// deepfake voice check in T7) WITHOUT the spec ever containing model code, an
// endpoint, or a secret: the spec says `runCapability: "voice-detector"`, and
// the capability's implementation — which calls DeepBlocker's proprietary
// detector through the same keyed proxy the app already uses — lives here.
//
// Adding a capability is a deliberate, reviewed engine change (it grows the
// vocabulary); it never weakens the "specs are inert data" guarantee.

import { verifyBundledClip, type DetectorVerdict } from '../data/api.ts';

export type CapabilityName = 'voice-detector';

/** Runtime allow-list used by the spec validator (a spec may only name these). */
export const CAPABILITY_NAMES: ReadonlySet<string> = new Set<CapabilityName>(['voice-detector']);

type Band = NonNullable<DetectorVerdict['band']>;

// Fixed clip registry — a spec supplies only a clip ID, never a path/URL. The
// fallback band is the clip's known verdict, used when the live detector is cold
// or unavailable so a run never stalls (mirrors the T7 code path exactly).
const CLIPS: Record<string, { path: string; fallbackBand: Band }> = {
  'synthetic-caller': { path: '/audio/synthetic-caller.webm', fallbackBand: 'FAKE' },
};

/**
 * Run a named capability and return a short result string (e.g. a detector
 * band). Total: an unknown capability or clip resolves to a safe default rather
 * than throwing, so an interpreter loop can never be broken by a bad reference.
 */
export async function runCapability(name: CapabilityName, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'voice-detector': {
      const clip = CLIPS[String(args.clip ?? '')] ?? CLIPS['synthetic-caller']!;
      const live = await verifyBundledClip(clip.path).catch(() => null);
      return live?.status === 'ok' && live.band ? live.band : clip.fallbackBand;
    }
    default:
      return '';
  }
}
