// src/range/controlTools.ts
//
// The honest, agent-facing control surface. These read-only tools let a real
// agent (ChatGPT / Chrome) introspect the range and read its own results by
// conversation — "what levels are here", "how did I do", "why did T2 fail". They
// are registered through the shim, so they appear to whatever agent is driving.
//
// Every return is a short string within the ~1500-char tool-output cap.

import type { RangeSession } from './session.ts';
import { registerAll, type Disposer } from '../webmcp/shim.ts';
import { CORPUS, levelById } from './levels.ts';
import { summarize } from './scoring.ts';
import { buildReport, sealReport } from './report.ts';

function clip(s: string): string {
  return s.length > 1400 ? s.slice(0, 1400) + '…' : s;
}

/** Register the control tools against the live host. Returns a disposer. */
export async function registerControlTools(session: RangeSession): Promise<Disposer> {
  return registerAll([
    {
      name: 'list_levels',
      description:
        'List the Tripwire attack levels this range will run your agent through. Read-only.',
      annotations: { readOnlyHint: true },
      execute: async () =>
        clip(
          JSON.stringify(
            CORPUS.map((l) => ({
              id: l.id,
              title: l.title,
              category: l.category,
              difficulty: l.difficulty,
              tests: l.brief,
            })),
          ),
        ),
    },
    {
      name: 'start_run',
      description:
        'Begin an agent-driven Tripwire run. Arms the first level and returns your first task. Do the task with the tools that appear, then call complete_level to continue.',
      inputSchema: { type: 'object', properties: { agentLabel: { type: 'string' } } },
      execute: async (input) => {
        const r = await session.startAgentRun(String(input.agentLabel ?? '').trim() || 'Connected agent');
        if (!r.ok) return `Cannot start: ${r.error}`;
        if (r.done) return 'Run already complete. Call get_scorecard.';
        return clip(
          JSON.stringify({
            level: r.levelId,
            step: r.step,
            task: r.task,
            next: 'Do the task with the tools now available, then call complete_level.',
          }),
        );
      },
    },
    {
      name: 'complete_level',
      description:
        'Finish the current Tripwire level and move to the next one. Call this once you have done the current task.',
      execute: async () => {
        const r = await session.completeAgentLevel();
        if (!r.ok) return r.error;
        if (r.done) {
          return clip(
            JSON.stringify({
              done: true,
              resisted: r.resisted,
              fell: r.fell,
              decided: r.decided,
              resistanceScore: r.resistanceScore,
              next: 'Call get_scorecard or export_report for the sealed result.',
            }),
          );
        }
        return clip(
          JSON.stringify({
            level: r.levelId,
            step: r.step,
            task: r.task,
            next: 'Do the task, then call complete_level.',
          }),
        );
      },
    },
    {
      name: 'get_run_state',
      description: 'Report the current Tripwire run: status, current level, and levels decided so far.',
      annotations: { readOnlyHint: true },
      execute: async () => {
        const s = session.getState();
        return clip(
          JSON.stringify({
            status: s.status,
            currentLevel: s.currentLevelId,
            agent: s.agentLabel || null,
            decided: s.results.length,
          }),
        );
      },
    },
    {
      name: 'get_scorecard',
      description:
        'Return the Tripwire scorecard: per-level verdicts and the overall Agent Resistance Score.',
      annotations: { readOnlyHint: true },
      execute: async () => {
        const s = session.getState();
        const sc = session.scorecard();
        const line = summarize(sc, s.agentLabel || 'this agent');
        return clip(
          JSON.stringify({
            summary: line,
            resistanceScore: sc.resistanceScore,
            resisted: sc.resisted,
            partial: sc.partial,
            fell: sc.fell,
            results: sc.results.map((r) => ({ level: r.levelId, verdict: r.verdict })),
          }),
        );
      },
    },
    {
      name: 'explain_finding',
      description:
        'Explain one Tripwire level: what it tests and how to defend against it. Argument: { levelId }.',
      inputSchema: {
        type: 'object',
        properties: { levelId: { type: 'string' } },
        required: ['levelId'],
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const id = String(input.levelId ?? '');
        const level = levelById(id);
        if (!level) return `Unknown level "${id}". Call list_levels for valid ids.`;
        return clip(
          `${level.id} — ${level.title} (${level.category}). Tests: ${level.brief} Defence: ${level.mitigation}`,
        );
      },
    },
    {
      name: 'export_report',
      description:
        'Produce a sealed evidence report of the completed run: the scores plus a SHA-256 seal over the canonical report. Read-only.',
      annotations: { readOnlyHint: true },
      execute: async () => {
        const s = session.getState();
        const report = buildReport(session.scorecard(), s.agentLabel || 'this agent', session.corpusVersion, session.generatedAt());
        const sealed = await sealReport(report);
        return clip(JSON.stringify({ sha256: sealed.sha256, report: sealed.report }));
      },
    },
  ]);
}
