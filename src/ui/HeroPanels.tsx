// src/ui/HeroPanels.tsx
//
// The three products, side by side in the hero, each with its own live readout
// so it is obvious at a glance that Tripwire does three distinct things — not
// one badge. Each panel is keyed to one line of the headline.
//
// Instrument-panel language: monospace readouts, hairline rules, tight radii,
// exposed structure. Deliberately not three soft SaaS cards.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function useTick(steps: number, ms: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setN(steps);
      return;
    }
    const iv = setInterval(() => {
      setN((v) => {
        if (v >= steps) {
          clearInterval(iv);
          return v;
        }
        return v + 1;
      });
    }, ms);
    return () => clearInterval(iv);
  }, [steps, ms]);
  return n;
}

/** 01 — the range: an agent under attack, verdict by verdict. */
function PanelTest() {
  const rows = [
    { id: 'T1', label: 'hidden instruction', v: 'held' as const },
    { id: 'T2', label: 'unlabelled content', v: 'held' as const },
    { id: 'T4', label: 'lookalike tool', v: 'fell' as const },
    { id: 'T6', label: 'cross-origin relay', v: 'held' as const },
  ];
  const n = useTick(rows.length, 520);
  return (
    <div className="hp-readout">
      {rows.map((r, i) => (
        <div key={r.id} className={`hp-line ${i < n ? 'in' : ''}`}>
          <span className="hp-id mono">{r.id}</span>
          <span className="hp-lab">{r.label}</span>
          <span className={`hp-v ${r.v}`}>{r.v}</span>
        </div>
      ))}
      <div className={`hp-total ${n >= rows.length ? 'in' : ''}`}>
        <span className="mono hp-score">3 / 4</span> resisted
      </div>
    </div>
  );
}

/** 02 — the scan: a live surface read, one descriptor poisoned. */
function PanelScan() {
  const rows = [
    { name: 'search_products', v: 'ok' as const },
    { name: 'read_reviews', v: 'ok' as const },
    { name: 'sync_account', v: 'flag' as const },
  ];
  const n = useTick(rows.length, 560);
  return (
    <div className="hp-readout">
      <div className="hp-url mono">shop.example</div>
      {rows.map((r, i) => (
        <div key={r.name} className={`hp-line ${i < n ? 'in' : ''}`}>
          <span className="hp-lab mono">{r.name}</span>
          <span className={`hp-v ${r.v}`}>{r.v === 'flag' ? 'flag' : 'ok'}</span>
        </div>
      ))}
      <div className={`hp-total ${n >= rows.length ? 'in' : ''}`}>
        <span className="hp-warn">injected instruction</span> in 1 description
      </div>
    </div>
  );
}

/** 03 — the seal: a signed, live-checked, revocable badge. */
function PanelSeal() {
  const n = useTick(3, 620);
  return (
    <div className="hp-readout">
      <div className={`hp-seal ${n >= 1 ? 'in' : ''}`}>
        <span className="hp-seal-dot" />
        <span className="hp-seal-txt">Tripwire: verified</span>
      </div>
      <div className={`hp-line ${n >= 2 ? 'in' : ''}`}>
        <span className="hp-lab">fingerprint</span>
        <span className="hp-id mono">d87dad61…</span>
      </div>
      <div className={`hp-line ${n >= 3 ? 'in' : ''}`}>
        <span className="hp-lab">signature</span>
        <span className="hp-id mono">Ed25519</span>
      </div>
      <div className={`hp-total ${n >= 3 ? 'in' : ''}`}>
        re-checked hourly · <span className="hp-warn">revocable</span>
      </div>
    </div>
  );
}

const PANELS = [
  {
    n: '01',
    verb: 'Test',
    to: '/range',
    title: 'the agent',
    desc: 'Put an AI agent through a corpus of tool-surface attacks and see, live, what it falls for.',
    cta: 'Open the range',
    tone: 'warn',
    body: <PanelTest />,
  },
  {
    n: '02',
    verb: 'Scan',
    to: '/scan',
    title: 'the site',
    desc: 'Point us at any URL. We open it in a real browser and read what its tools tell an agent to do.',
    cta: 'Scan a URL',
    tone: 'signal',
    body: <PanelScan />,
  },
  {
    n: '03',
    verb: 'Seal',
    to: '/badge',
    title: 'the surface',
    desc: 'Prove you own the domain and earn a signed badge that dies the moment your tools change.',
    cta: 'Get a badge',
    tone: 'ok',
    body: <PanelSeal />,
  },
];

export function HeroPanels() {
  return (
    <div className="hp">
      {PANELS.map((p) => (
        <Link key={p.n} to={p.to} className={`hp-panel tone-${p.tone}`} data-reveal>
          <div className="hp-head">
            <span className="hp-n mono">{p.n}</span>
            <h2 className="hp-title">
              {p.verb} <span className="hp-title-2">{p.title}</span>
            </h2>
          </div>
          <p className="hp-desc">{p.desc}</p>
          {p.body}
          <span className="hp-cta">{p.cta} →</span>
        </Link>
      ))}
    </div>
  );
}
