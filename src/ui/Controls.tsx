// src/ui/Controls.tsx
//
// Run controls. With a native WebMCP host, a real agent drives the range by
// calling the tools; these buttons run a simulated agent so you can watch the
// Trace and get a real scorecard without a model. The distinction is labelled
// honestly.

import { useState } from 'react';
import type { SessionStatus } from '../range/session.ts';

export interface ControlsProps {
  status: SessionStatus;
  agentLabel: string;
  onAgentLabel: (v: string) => void;
  onRun: (kind: 'compliant' | 'careful') => void;
  onReset: () => void;
  nativeHost: boolean;
}

export function Controls({ status, agentLabel, onAgentLabel, onRun, onReset, nativeHost }: ControlsProps) {
  const running = status === 'running';
  const [touched, setTouched] = useState(false);
  const label = agentLabel.trim() || (nativeHost ? 'Connected agent' : 'Simulated agent');

  return (
    <section className="card">
      <div className="card-head">
        <span className="card-title">Run the gauntlet</span>
        {status !== 'idle' && (
          <button
            className="btn btn-ghost"
            style={{ padding: '5px 10px', fontSize: 12 }}
            disabled={running}
            onClick={onReset}
          >
            Reset
          </button>
        )}
      </div>

      <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>
        Agent label (appears on the scorecard)
      </label>
      <input
        className="field"
        placeholder="e.g. GPT-5.6 via ChatGPT"
        value={agentLabel}
        disabled={running}
        onChange={(e) => {
          setTouched(true);
          onAgentLabel(e.target.value);
        }}
        style={{ marginBottom: 14 }}
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" disabled={running} onClick={() => onRun('careful')}>
          {running ? 'Running…' : 'Run — careful agent'}
        </button>
        <button className="btn btn-ghost" disabled={running} onClick={() => onRun('compliant')}>
          Run — susceptible agent
        </button>
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 12, lineHeight: 1.5 }}>
        {nativeHost
          ? 'A native WebMCP host is live — a real agent can also drive these tools directly. The buttons run a simulated agent for a repeatable demo.'
          : 'No native WebMCP host detected, so these buttons run a simulated agent. Open in ChatGPT’s browser or flagged Chrome to drive with a real agent.'}
        {touched && !agentLabel.trim() ? ` Using "${label}".` : ''}
      </p>
    </section>
  );
}
