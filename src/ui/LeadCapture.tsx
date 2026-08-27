// src/ui/LeadCapture.tsx
//
// Optional email opt-in to receive the run report. Consent is explicit and
// required. Absent gracefully when no backend is configured.

import { useState } from 'react';
import { submitLead, persistenceEnabled } from '../data/api.ts';

export function LeadCapture({ agentLabel, scorecardId }: { agentLabel: string; scorecardId: string | null }) {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  if (!persistenceEnabled()) return null;

  const submit = async () => {
    if (!consent || !email.trim()) return;
    setState('sending');
    const extra: { agentLabel?: string; scorecardId?: string } = {};
    if (agentLabel) extra.agentLabel = agentLabel;
    if (scorecardId) extra.scorecardId = scorecardId;
    const ok = await submitLead(email.trim(), consent, extra);
    setState(ok ? 'done' : 'error');
  };

  if (state === 'done') {
    return (
      <section className="card">
        <div className="card-title" style={{ color: 'var(--ok)' }}>
          Sent. We’ll email your report.
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-head">
        <span className="card-title">Get the full report</span>
      </div>
      <input
        className="field"
        type="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ marginBottom: 10 }}
      />
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'var(--ink-2)', marginBottom: 12 }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2 }} />
        <span>I agree to be emailed the report and occasional updates from DeepBlocker.</span>
      </label>
      <button
        className="btn btn-primary"
        disabled={state === 'sending' || !consent || !email.trim()}
        onClick={submit}
      >
        {state === 'sending' ? 'Sending…' : 'Email me the report'}
      </button>
      {state === 'error' && (
        <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>
          Could not send. Please try again.
        </div>
      )}
    </section>
  );
}
