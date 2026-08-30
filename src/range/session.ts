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
import { runLevel, CORPUS_VERSION, type Archetype, type ArmedLevel, type LevelDefinition } from './level.ts';
import { CORPUS } from './corpusLoader.ts';
import { mintCanary } from './canary.ts';
import { buildScorecard, type LevelResult, type Scorecard } from './scoring.ts';

/** What start_run / complete_level report back to a driving agent. */
export type AgentStep =
  | { ok: false; error: string }
  | { ok: true; done: false; levelId: string; step: string; task: string }
  | { ok: true; done: true; resisted: number; fell: number; decided: number; resistanceScore: number | null };

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
  private runGeneratedAt: string | null = null;
  // How the current run was started: a scripted 'demo' (the UI buttons) or a real
  // 'agent'-driven run (start_run via the WebMCP tools). Only 'agent' runs are
  // ranked — a demo must NEVER reach the public leaderboard, on any host, whatever
  // its label (on a native host the demo label defaults to 'Connected agent',
  // identical to an agent run, so the label alone cannot distinguish them).
  private runKind: 'demo' | 'agent' | null = null;

  /** How the current/last run was started, for the persistence gate. */
  getRunKind(): 'demo' | 'agent' | null {
    return this.runKind;
  }

  // The corpus this session runs. Defaults to the public corpus; the page may
  // swap in public + premium (buildFullCorpus) when the visitor is entitled.
  private corpus: LevelDefinition[] = CORPUS;

  /** Replace the corpus (e.g. after fetching premium specs). Safe when idle. */
  setCorpus(levels: LevelDefinition[]): void {
    this.corpus = levels;
  }

  // Agent-driven run state (one level armed at a time).
  private agentIndex = 0;
  private currentArmed: ArmedLevel | null = null;

  /** ISO timestamp the current run finished (for the sealed report). */
  generatedAt(): string {
    return this.runGeneratedAt ?? new Date().toISOString();
  }

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
   * Run the whole corpus for one demonstration archetype. With a native host a
   * real agent can also drive the same tools directly; this simulated run makes
   * the range watchable and scoreable without a model. Safe to call when
   * idle/done; it resets first.
   */
  async run(archetype: Archetype, agentLabel: string): Promise<Scorecard> {
    const host = resolveHost().host;
    if (!host) {
      this.bus.emit({ kind: 'note', label: 'run', detail: 'no WebMCP host available' });
      return this.scorecard();
    }

    this.disposeCurrentArmed();
    this.runKind = 'demo';
    this.bus.clear();
    this.set({ status: 'running', agentLabel, results: [], currentLevelId: null });
    this.bus.emit({ kind: 'note', label: 'run', detail: `started · agent = ${agentLabel}` });

    const results: LevelResult[] = [];
    for (const level of this.corpus) {
      this.set({ currentLevelId: level.id });
      const result = await runLevel(level, host, archetype, this.bus);
      results.push(result);
      this.set({ results: [...results] });
    }

    this.runGeneratedAt = new Date().toISOString();
    this.set({ status: 'done', currentLevelId: null });
    this.bus.emit({ kind: 'note', label: 'run', detail: 'complete' });
    return this.scorecard();
  }

  reset(): void {
    this.disposeCurrentArmed();
    this.runKind = null;
    this.bus.clear();
    this.set({ status: 'idle', results: [], currentLevelId: null });
  }

  private disposeCurrentArmed(): void {
    try {
      this.currentArmed?.dispose();
    } catch {
      /* dispose must never throw out of teardown */
    }
    this.currentArmed = null;
  }

  // ── Agent-driven run ───────────────────────────────────────────────────────
  // A real agent drives the level tools directly, one level at a time. start_run
  // arms the first level and hands back a task; the agent does it with the tools
  // that appear, then calls complete_level to advance. This is what actually
  // tests the agent (vs the simulated run, which is a scripted demo).

  private async armAgentLevel(host: ReturnType<typeof resolveHost>['host'], index: number): Promise<AgentStep> {
    const level = this.corpus[index];
    if (!host || !level) return { ok: false, error: 'no level to arm' };
    const canary = mintCanary();
    this.bus.emit({ kind: 'level_started', label: level.id });
    this.currentArmed = await level.arm({ canary, telemetry: this.bus, host });
    this.set({ currentLevelId: level.id });
    return { ok: true, done: false, levelId: level.id, step: `${index + 1}/${this.corpus.length}`, task: level.task };
  }

  /** Begin an agent-driven run and arm the first level. */
  async startAgentRun(agentLabel: string): Promise<AgentStep> {
    const host = resolveHost().host;
    if (!host) return { ok: false, error: 'no WebMCP host available' };
    this.disposeCurrentArmed();
    this.runKind = 'agent';
    this.bus.clear();
    this.agentIndex = 0;
    this.runGeneratedAt = null;
    this.set({ status: 'running', agentLabel, results: [], currentLevelId: null });
    this.bus.emit({ kind: 'note', label: 'run', detail: `agent run started · ${agentLabel}` });
    return this.armAgentLevel(host, 0);
  }

  /** Score the current level, then arm the next one (or finish). */
  async completeAgentLevel(): Promise<AgentStep> {
    const level = this.corpus[this.agentIndex];
    if (this.state.status !== 'running' || !this.currentArmed || !level) {
      return { ok: false, error: 'no level in progress — call start_run first' };
    }
    const verdict = this.currentArmed.evaluate();
    this.bus.emit({ kind: 'level_scored', label: level.id, detail: verdict, hostile: verdict === 'FAIL' });
    const results: LevelResult[] = [
      ...this.state.results,
      { levelId: level.id, category: level.category, verdict },
    ];
    this.disposeCurrentArmed();
    this.agentIndex++;

    if (this.agentIndex < this.corpus.length) {
      this.set({ results });
      return this.armAgentLevel(resolveHost().host, this.agentIndex);
    }

    this.runGeneratedAt = new Date().toISOString();
    this.set({ status: 'done', currentLevelId: null, results });
    this.bus.emit({ kind: 'note', label: 'run', detail: 'agent run complete' });
    const sc = buildScorecard(results);
    return { ok: true, done: true, resisted: sc.resisted, fell: sc.fell, decided: sc.decided, resistanceScore: sc.resistanceScore };
  }
}
