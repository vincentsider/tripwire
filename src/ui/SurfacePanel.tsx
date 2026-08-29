// src/ui/SurfacePanel.tsx
//
// The hero artifact: the actual signed report Tripwire issued for
// openclawcity.ai — the first badge on the agent web. Every value below is real
// and independently checkable: GET /api/badge?origin=https://openclawcity.ai
// returns this fingerprint, assurance score, key id and signature prefix.
//
// Deliberately NOT a browser mock-up. No window chrome, no traffic lights, no
// "illustrative" caption — this is the artifact the product actually produces,
// so it can stand on its own without a disclaimer.

import { useEffect, useState } from 'react';

/** Real tools from the signed openclawcity.ai audit (10 total, 4 shown). */
const TOOLS = [
  { name: 'read_city_guide', verdict: 'pass' as const },
  { name: 'look_around', verdict: 'pass' as const },
  { name: 'who_is_here', verdict: 'pass' as const },
  { name: 'enter_city', verdict: 'partial' as const },
];

const STEP_MS = 460;

export function SurfacePanel() {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(TOOLS.length + 1);
      return;
    }
    const iv = setInterval(() => {
      setShown((n) => {
        if (n >= TOOLS.length + 1) {
          clearInterval(iv);
          return n;
        }
        return n + 1;
      });
    }, STEP_MS);
    return () => clearInterval(iv);
  }, []);

  const sealed = shown > TOOLS.length;

  return (
    <figure className="rep">
      <figcaption className="rep-head">
        <div>
          <span className="rep-label">Signed surface audit</span>
          <span className="rep-origin mono">openclawcity.ai</span>
        </div>
        <span className={`rep-state ${sealed ? 'in' : ''}`}>
          <span className="rep-tick" aria-hidden>
            ✓
          </span>
          verified
        </span>
      </figcaption>

      <div className="rep-grid">
        <div className="rep-metric">
          <span className="rep-metric-n mono">10</span>
          <span className="rep-metric-l">tools audited</span>
        </div>
        <div className="rep-metric">
          <span className="rep-metric-n mono">0.98</span>
          <span className="rep-metric-l">assurance score</span>
        </div>
      </div>

      <ul className="rep-tools">
        {TOOLS.map((t, i) => (
          <li key={t.name} className={i < shown ? 'in' : ''}>
            <span className="mono">{t.name}</span>
            <span className={`rep-v ${t.verdict}`}>{t.verdict === 'partial' ? 'review' : 'pass'}</span>
          </li>
        ))}
        <li className={`rep-more ${shown >= TOOLS.length ? 'in' : ''}`}>+ 6 more</li>
      </ul>

      <div className={`rep-seal ${sealed ? 'in' : ''}`}>
        <div className="rep-seal-row">
          <span className="rep-seal-k">fingerprint</span>
          <span className="mono rep-seal-v">d87dad615a4c…70338415</span>
        </div>
        <div className="rep-seal-row">
          <span className="rep-seal-k">signature</span>
          <span className="mono rep-seal-v">Ed25519 · key k1 · dboDoFGqoZi0…</span>
        </div>
        <div className="rep-seal-row">
          <span className="rep-seal-k">re-checked</span>
          <span className="mono rep-seal-v">hourly · revocable</span>
        </div>
      </div>
    </figure>
  );
}
