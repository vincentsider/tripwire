// src/range/session.ts
//
// RangeSession owns a single run: the telemetry bus, the ordered pass over the
// corpus, and the accumulating results. The UI subscribes for state; the Trace
// subscribes to the bus. The same session is what the agent-facing control tools
// read, so a real agent and the UI always see one consistent picture.
//
// Memory-safety: one bounded bus per session; subscribers are held in a Set and
// released on unsubscribe; reset() clears the bus.

import { TelemetryBus } from './telemetry.ts';
import { resolveHost } from '../webmcp/shim.ts';
import { runLevel, CORPUS_VERSION, type AgentDriver } from './level.ts';
import { CORPUS } from './levels.ts';
import { buildScorecard, type LevelResult, type Scorecard } from './scoring.ts';

export type SessionStatus = 'idle' | 'running' | 'done';

export interface SessionState {
  status: SessionStatus;
  agentLabel: string;
  currentLevelId: string | null;
  results: LevelResult[];
}

export class RangeSession {
  readonly bus = new TelemetryBus({ capacity: 500 });
  readonly corpusVersion = CORPUS_VERSION;

  private state: SessionState = {
    status: 'idle',
    agentLabel: '',
    currentLevelId: null,
    results: [],
  };
  private subs = new Set<(s: SessionState) => void>();

  getState(): SessionState {
    return this.state;
  }

  subscribe(cb: (s: SessionState) => void): () => void {
    this.subs.add(cb);
    return () => {
      this.subs.delete(cb);
    };
  }

  scorecard(): Scorecard {
    return buildScorecard(this.state.results);
  }

  private set(patch: Partial<SessionState>): void {
    this.state = { ...this.state, ...patch };
    for (const s of [...this.subs]) {
      try {
        s(this.state);
      } catch {
        /* a broken view subscriber must not break the run */
      }
    }
  }

  /**
   * Run the whole corpus with the given driver. In production the driver waits
   * for the external agent; in a local demo it is a simulated agent. Safe to
   * call only when idle/done; a second call resets first.
   */
  async run(driver: AgentDriver, agentLabel: string): Promise<Scorecard> {
    const host = resolveHost().host;
    if (!host) {
      this.bus.emit({ kind: 'note', label: 'run', detail: 'no WebMCP host available' });
      return this.scorecard();
    }

    this.bus.clear();
    this.set({ status: 'running', agentLabel, results: [], currentLevelId: null });
    this.bus.emit({ kind: 'note', label: 'run', detail: `started · agent = ${agentLabel}` });

    const results: LevelResult[] = [];
    for (const level of CORPUS) {
      this.set({ currentLevelId: level.id });
      const result = await runLevel(level, host, driver, this.bus);
      results.push(result);
      this.set({ results: [...results] });
    }

    this.set({ status: 'done', currentLevelId: null });
    this.bus.emit({ kind: 'note', label: 'run', detail: 'complete' });
    return this.scorecard();
  }

  reset(): void {
    this.bus.clear();
    this.set({ status: 'idle', results: [], currentLevelId: null });
  }
}
