// src/ui/App.tsx
//
// The Tripwire console. Owns one RangeSession, registers the agent-facing
// control tools once, streams the live Trace as the centerpiece, and shows the
// scorecard, leaderboard and report opt-in alongside. Persistence is wired
// through the Worker and degrades to a no-op when no backend is configured.

import { useEffect, useMemo, useRef, useState } from 'react';
import { RangeSession, type SessionState } from '../range/session.ts';
import { registerControlTools } from '../range/controlTools.ts';
import { compliantAgent, carefulAgent } from '../range/simAgents.ts';
import { hostSource, isWebMcpAvailable } from '../webmcp/shim.ts';
import { saveScorecard } from '../data/api.ts';
import type { HostSource } from '../webmcp/types.ts';
import { Trace } from './Trace.tsx';
import { Scorecard } from './Scorecard.tsx';
import { Controls } from './Controls.tsx';
import { Leaderboard } from './Leaderboard.tsx';
import { LeadCapture } from './LeadCapture.tsx';

const HOST_LABEL: Record<HostSource, string> = {
  document: 'native · document.modelContext',
  navigator: 'native · navigator.modelContext',
  polyfill: 'polyfill · dev fallback',
  none: 'no host',
};

export function App() {
  // One session for the app's lifetime.
  const session = useMemo(() => new RangeSession(), []);
  const [state, setState] = useState<SessionState>(session.getState());
  const [agentLabel, setAgentLabel] = useState('');
  const [scorecardId, setScorecardId] = useState<string | null>(null);
  const [leaderboardKey, setLeaderboardKey] = useState(0);
  const savingRef = useRef(false);

  const source = hostSource();
  const nativeHost = source === 'document' || source === 'navigator';

  // Subscribe to session state.
  useEffect(() => session.subscribe(setState), [session]);

  // Register the agent-facing control tools once; tear them down on unmount.
  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;
    registerControlTools(session).then((d) => {
      if (cancelled) d();
      else dispose = d;
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [session]);

  const run = async (kind: 'compliant' | 'careful') => {
    if (state.status === 'running' || savingRef.current) return;
    setScorecardId(null);
    const label = agentLabel.trim() || (nativeHost ? 'Connected agent' : 'Simulated agent');
    const driver = kind === 'compliant' ? compliantAgent : carefulAgent;
    const scorecard = await session.run(driver, label);

    // Persist (no-op when no backend). Guard against double-save.
    if (!savingRef.current) {
      savingRef.current = true;
      try {
        const id = await saveScorecard(scorecard, label, session.corpusVersion);
        setScorecardId(id);
        if (id) setLeaderboardKey((k) => k + 1);
      } finally {
        savingRef.current = false;
      }
    }
  };

  const scorecard = session.scorecard();

  return (
    <div className="wrap">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>DeepBlocker · WebMCP assurance range</div>
          <h1 style={{ fontSize: 30, letterSpacing: '-0.02em', margin: 0 }}>Tripwire</h1>
          <p style={{ color: 'var(--ink-2)', fontSize: 14, maxWidth: 560, marginTop: 8, lineHeight: 1.5 }}>
            Run your AI agent through a corpus of WebMCP tool-surface attacks and watch, live, what
            gets through. Every payload is an inert marker, never a real exploit.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span
            className="pill"
            style={{
              background: isWebMcpAvailable() ? 'var(--signal-soft)' : 'var(--danger-soft)',
              color: isWebMcpAvailable() ? 'var(--signal)' : 'var(--danger)',
            }}
          >
            <span className="dot" style={{ background: 'currentColor' }} />
            {HOST_LABEL[source]}
          </span>
        </div>
      </header>

      <div className="grid-main">
        {/* Left column: controls + the live Trace centerpiece. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Controls
            status={state.status}
            agentLabel={agentLabel}
            onAgentLabel={setAgentLabel}
            onRun={run}
            onReset={() => {
              session.reset();
              setScorecardId(null);
            }}
            nativeHost={nativeHost}
          />
          <Trace bus={session.bus} live={state.status === 'running'} />
        </div>

        {/* Right column: scorecard, leaderboard, report opt-in. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Scorecard scorecard={scorecard} agentLabel={state.agentLabel || agentLabel} />
          {state.status === 'done' && (
            <LeadCapture agentLabel={state.agentLabel || agentLabel} scorecardId={scorecardId} />
          )}
          <Leaderboard refreshKey={leaderboardKey} />
        </div>
      </div>

      <footer style={{ marginTop: 40, borderTop: '1px solid var(--hair)', paddingTop: 18, fontSize: 12, color: 'var(--ink-3)' }}>
        Open source (Apache-2.0). Inert payloads only — see SECURITY.md. A DeepBlocker project.
      </footer>
    </div>
  );
}
