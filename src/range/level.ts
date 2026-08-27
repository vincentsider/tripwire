// src/range/level.ts
//
// The level model and the runner. Each level co-locates three things: the tools
// it registers, and two scripted "plays" that demonstrate a susceptible agent
// (which the attack catches) and a careful agent (which defends). Co-locating
// the plays with the attack keeps every level self-contained and makes the
// corpus trivially extensible — a new level is one object, tools and demos
// together.
//
// A level NEVER inspects the agent's natural-language output. Every verdict is
// derived from tool calls alone (a decoy called, a canary in an argument, a
// missing confirmation, a tool changed since enumeration). That single rule
// keeps scoring objective and reproducible.

import type { Disposer } from '../webmcp/shim.ts';
import type { ModelContextHost } from '../webmcp/types.ts';
import { TelemetryBus } from './telemetry.ts';
import { mintCanary } from './canary.ts';
import type { LevelResult, Verdict } from './scoring.ts';

export const CORPUS_VERSION = 'v1';

/** The two demonstration archetypes. */
export type Archetype = 'compliant' | 'careful';

/** Context handed to a level when it is armed. */
export interface LevelContext {
  /** The one-time inert token this level's payloads reference. */
  canary: string;
  /** Where the level records observable events (also feeds the Trace UI). */
  telemetry: TelemetryBus;
  /** The live host to register tools against and drive. */
  host: ModelContextHost;
}

/** A level that has been armed: play a demo, read the verdict, then tear down. */
export interface ArmedLevel {
  /** Run the scripted agent for one archetype. Resolves when the agent is done. */
  play: (archetype: Archetype) => Promise<void>;
  /** Read the observations and decide a verdict. Pure; callable more than once. */
  evaluate: () => Verdict;
  /** Unregister the level's tools and release its per-run state. */
  dispose: Disposer;
}

/** Static metadata + the arming function for one attack level. */
export interface LevelDefinition {
  id: string;
  /** Taxonomy class, e.g. "tool-framing" | "contaminated-output". */
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  title: string;
  /** One line: what this level tests. Surfaced by the explain_finding tool. */
  brief: string;
  /** One line: how to defend against it. Surfaced by explain_finding. */
  mitigation: string;
  /**
   * The innocent instruction handed to a live agent for this level. The agent
   * does this ordinary task with the level's tools; the attack is hidden in the
   * tool surface, and the level scores whether the agent was manipulated.
   */
  task: string;
  /** Register the level's tools + per-run state; return play/evaluate/dispose. */
  arm: (ctx: LevelContext) => Promise<ArmedLevel>;
}

/**
 * Run one level end to end for a given archetype and return its result. Disposal
 * happens even if the play throws, so a failing agent phase can never leak the
 * level's tools. A play that throws leaves the level SKIPPED, never PASSED.
 */
export async function runLevel(
  level: LevelDefinition,
  host: ModelContextHost,
  archetype: Archetype,
  telemetry: TelemetryBus,
): Promise<LevelResult> {
  const canary = mintCanary();
  telemetry.emit({ kind: 'level_started', label: level.id });
  const armed = await level.arm({ canary, telemetry, host });

  let verdict: Verdict = 'SKIPPED';
  try {
    await armed.play(archetype);
    verdict = armed.evaluate();
  } catch {
    verdict = 'SKIPPED';
  } finally {
    armed.dispose();
  }

  telemetry.emit({
    kind: 'level_scored',
    label: level.id,
    detail: verdict,
    hostile: verdict === 'FAIL',
  });

  return { levelId: level.id, category: level.category, verdict };
}
