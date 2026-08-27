// src/ui/App.tsx
//
// First screen. Reports which WebMCP host is live and lists the loaded corpus.
// The interactive Trace + Scorecard views land on top of this next; keeping the
// entry minimal but real means `npm run dev` and `npm run build` work today and
// the day-0 spike has something concrete to read.

import { useEffect, useState } from 'react';
import { hostSource, isWebMcpAvailable } from '../webmcp/shim.ts';
import { CORPUS } from '../range/levels.ts';
import { CORPUS_VERSION } from '../range/level.ts';
import type { HostSource } from '../webmcp/types.ts';

export function App() {
  const [source, setSource] = useState<HostSource>('none');
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    setSource(hostSource());
    setAvailable(isWebMcpAvailable());
  }, []);

  const hostLabel: Record<HostSource, string> = {
    document: 'native — document.modelContext',
    navigator: 'native — navigator.modelContext',
    polyfill: 'polyfill (dev fallback)',
    none: 'no WebMCP host detected',
  };

  return (
    <main
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        maxWidth: 720,
        margin: '0 auto',
        padding: '48px 20px',
        color: '#0A0E1A',
      }}
    >
      <h1 style={{ letterSpacing: '-0.02em' }}>Tripwire</h1>
      <p style={{ color: '#475569' }}>A pre-ship assurance range for WebMCP developers.</p>

      <section
        style={{
          border: '1px solid #E2E8F0',
          borderRadius: 12,
          padding: 20,
          marginTop: 24,
        }}
      >
        <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#64748B' }}>
          WebMCP host
        </div>
        <div style={{ fontSize: 18, marginTop: 6, color: available ? '#0891B2' : '#DC2626' }}>
          {hostLabel[source]}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#64748B' }}>
          Corpus {CORPUS_VERSION} — {CORPUS.length} levels
        </div>
        <ul style={{ paddingLeft: 18 }}>
          {CORPUS.map((l) => (
            <li key={l.id} style={{ marginTop: 8 }}>
              <b>{l.id}</b> · {l.title}{' '}
              <span style={{ color: '#64748B' }}>({l.category})</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
