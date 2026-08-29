// src/ui/pages/RangePage.tsx
//
// Mode 1: the WebMCP assurance range. Owns one RangeSession, registers the
// agent-facing control tools once, streams the live Trace as the centerpiece,
// and shows the scorecard, leaderboard and report opt-in alongside. (Moved here
// unchanged from the former single-page App when the site gained navigation.)

import { useEffect, useMemo, useRef, useState } from 'react';
import { RangeSession, type SessionState } from '../../range/session.ts';
import { registerControlTools } from '../../range/controlTools.ts';
import { hostSource, isWebMcpAvailable } from '../../webmcp/shim.ts';
import { buildReport, sealReport } from '../../range/report.ts';
import { saveScorecard } from '../../data/api.ts';
import { shouldSaveRun } from '../persist.ts';
import type { HostSource } from '../../webmcp/types.ts';
import { Trace } from '../Trace.tsx';
import { Scorecard } from '../Scorecard.tsx';
import { Controls } from '../Controls.tsx';
import { Leaderboard } from '../Leaderboard.tsx';
import { LeadCapture } from '../LeadCapture.tsx';

const HOST_LABEL: Record<HostSource, string> = {
  document: 'native · document.modelContext',
  navigator: 'native · navigator.modelContext',
  polyfill: 'polyfill · dev fallback',
  none: 'no host',
};

export function RangePage() {
  const session = useMemo(() => new RangeSession(), []);
  const [state, setState] = useState<SessionState>(session.getState());
  const [agentLabel, setAgentLabel] = useState('');
  const [scorecardId, setScorecardId] = useState<string | null>(null);
  const [leaderboardKey, setLeaderboardKey] = useState(0);
  const savingRef = useRef(false);
  const lastSavedKeyRef = useRef<string | null>(null);

  const source = hostSource();
  const nativeHost = source === 'document' || source === 'navigator';

  useEffect(() => session.subscribe(setState), [session]);

  useEffect(() => {
    const runKey = session.generatedAt();
    if (!shouldSaveRun(state.status, runKey, lastSavedKeyRef.current, savingRef.current)) return;
    savingRef.current = true;
    lastSavedKeyRef.current = runKey;
    const label = session.getState().agentLabel || 'agent';
    void (async () => {
      try {
        const id = await saveScorecard(session.scorecard(), label, session.corpusVersion);
        setScorecardId(id);
        if (id) setLeaderboardKey((k) => k + 1);
      } finally {
        savingRef.current = false;
      }
    })();
  }, [state.status, state.results, session]);

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
    await session.run(kind, label);
  };

  const scorecard = session.scorecard();

  const downloadReport = async () => {
    const label = state.agentLabel || agentLabel || 'agent';
    const sealed = await sealReport(
      buildReport(session.scorecard(), label, session.corpusVersion, session.generatedAt()),
    );
    const blob = new Blob([JSON.stringify({ sha256: sealed.sha256, report: sealed.report }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tripwire-report-${sealed.sha256.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="page console">
      <header className="cx-head">
        <p className="cx-kick">Mode 1 · test an agent</p>
        <h1 className="cx-title">Put your agent on the range.</h1>
        <p className="cx-sub">
          Run it through a corpus of real tool-surface attacks and watch, live, what gets through. Every payload is an
          inert marker — never a real exploit.
        </p>
        <p style={{ marginTop: 18 }}>
          <span
            className="pill"
            style={{
              background: isWebMcpAvailable() ? 'rgba(34,211,238,.14)' : 'rgba(251,91,118,.16)',
              color: isWebMcpAvailable() ? '#67e8f9' : '#ffb3ba',
              border: '1px solid ' + (isWebMcpAvailable() ? 'rgba(34,211,238,.3)' : 'rgba(251,91,118,.32)'),
            }}
          >
            <span className="dot" style={{ background: 'currentColor' }} />
            {HOST_LABEL[source]}
          </span>
        </p>
      </header>

      <div className="grid-main">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Controls
            status={state.status}
            agentLabel={agentLabel}
            currentLevelId={state.currentLevelId}
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Scorecard
            scorecard={scorecard}
            agentLabel={state.agentLabel || agentLabel}
            onDownloadReport={state.status === 'done' ? downloadReport : undefined}
          />
          {state.status === 'done' && (
            <LeadCapture agentLabel={state.agentLabel || agentLabel} scorecardId={scorecardId} />
          )}
          <Leaderboard refreshKey={leaderboardKey} />
        </div>
      </div>
    </div>
  );
}
