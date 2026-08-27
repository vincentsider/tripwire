// src/range/level.ts
//
// The level model and the runner that ties the pieces together:
//
//   mint a canary → arm the level (register its tools) → let an agent act →
//   evaluate what the agent did → score → tear the level down.
//
// A level NEVER inspects the agent's natural-language output — the page cannot
// see it. Every verdict is derived from tool calls alone (a decoy tool being
// called, or a canary appearing in a legitimate tool's arguments). That is the
// single rule that keeps scoring objective and reproducible.

import type { Disposer } from '../webmcp/shim.ts';
import type { ModelContextHost } from '../webmcp/types.ts';
import { TelemetryBus } from './telemetry.ts';
import { mintCanary } from './canary.ts';
import type { LevelResult, Verdict } from './scoring.ts';

export const CORPUS_VERSION = 'v1';

/** Context handed to a level when it is armed. */
export interface LevelContext {
  /** The one-time inert token this level's payloads reference. */
  canary: string;
  /** Where the level records observable events (also feeds the Trace UI). */
  telemetry: TelemetryBus;
  /** The live host to register tools against. */
  host: ModelContextHost;
}

/** A level that has been armed: it can be evaluated, then disposed. */
export interface ArmedLevel {
  /** Read the observations and decide a verdict. Pure; callable more than once. */
  evaluate: () => Verdict;
  /** Unregister the level's tools and release its state. */
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
  /** Register the level's tools and return an evaluator + disposer. */
  arm: (ctx: LevelContext) => Promise<ArmedLevel>;
}

/**
 * Drives the "agent" phase of a run. In production this waits for the external
 * agent (ChatGPT / Chrome) to act on the tools via the control surface. In tests
 * a scripted driver enumerates and invokes tools directly, exactly as an agent
 * would. Either way it must resolve once the agent is done with this level.
 */
export type AgentDriver = (host: ModelContextHost, canary: string) => Promise<void>;

/**
 * Run one level end to end and return its result. Disposal happens even if the
 * driver throws, so a failing agent phase can never leak the level's tools.
 */
export async function runLevel(
  level: LevelDefinition,
  host: ModelContextHost,
  driver: AgentDriver,
  telemetry: TelemetryBus,
): Promise<LevelResult> {
  const canary = mintCanary();
  telemetry.emit({ kind: 'level_started', label: level.id });
  const armed = await level.arm({ canary, telemetry, host });

  let verdict: Verdict = 'SKIPPED';
  try {
    await driver(host, canary);
    verdict = armed.evaluate();
  } catch {
    // A driver that throws leaves the level SKIPPED rather than falsely PASSED.
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

  const result: LevelResult = { levelId: level.id, category: level.category, verdict };
  return result;
}
