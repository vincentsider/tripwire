// src/ui/pages/Home.tsx
//
// The landing page. Light editorial, inheriting the DeepBlocker brand.
//
// The structural fix for "every section looks the same": each section declares
// a data-env, and the page rotates through four environments —
// paper -> tint -> paper -> INK SLAB -> tint -> ACCENT BLEED -> paper. The slab
// and the accent bleed appear once each; scarcity is what makes them land.
//
// The compositions differ too, not just the colours: hero split, ruled index,
// stat strip, editorial quote pair, seal block, closing statement.

import { Link } from 'react-router-dom';
import '../landing.css';
import { useReveal } from '../useReveal.ts';
import { InspectionPass } from '../InspectionPass.tsx';

const PRODUCTS = [
  {
    n: '01',
    to: '/range',
    title: 'Test the agent',
    desc: 'Run an AI agent through a corpus of tool-surface attacks and watch, live, what it falls for.',
    go: 'Open the range',
  },
  {
    n: '02',
    to: '/scan',
    title: 'Scan the site',
    desc: 'Point us at any URL. We open it in a real browser and read what its tools tell an agent to do.',
    go: 'Scan a URL',
  },
  {
    n: '03',
    to: '/badge',
    title: 'Seal the surface',
    desc: 'Prove the domain is yours and earn a signed badge that stops applying the moment your tools change.',
    go: 'Get a badge',
  },
];

export function Home() {
  useReveal();

  return (
    <div className="lp">
      {/* ── Hero: paper ──────────────────────────────────────────────── */}
      <section className="lp-sec lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div data-reveal>
            <p className="lp-kicker">Trust layer for the agent web</p>
            <h1 className="lp-display">
              A description
              <br />
              is an instruction.
            </h1>
            <p className="lp-body">
              Websites now publish tools that AI agents can call on your behalf. The site writes the description — and
              an agent that reads it will follow it. Tripwire audits what those tools really say.
            </p>
            <div className="lp-cta">
              <Link to="/scan" className="lp-btn lp-btn-primary">
                Scan a site
              </Link>
              <Link to="/badge" className="lp-btn lp-btn-ghost">
                Get a badge
              </Link>
            </div>
          </div>

          <div data-reveal>
            <InspectionPass />
            <p className="ip-cap">Live example — watch the scan pass over the description.</p>
          </div>
        </div>
      </section>

      {/* ── Numbers: tint. Credibility device, straight after the hero ── */}
      <section className="lp-sec" data-env="tint">
        <div className="lp-wrap" data-reveal>
          <div className="lp-stats">
            <div className="lp-stat">
              <span className="lp-stat-n">7</span>
              <span className="lp-stat-l">attack classes</span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat-n">10</span>
              <span className="lp-stat-l">tools audited live</span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat-n">60m</span>
              <span className="lp-stat-l">re-check cadence</span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat-n">Ed25519</span>
              <span className="lp-stat-l">offline-verifiable</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── The three products: paper, as a ruled index ───────────────── */}
      <section className="lp-sec lp-sec-tall">
        <div className="lp-wrap">
          <div className="lp-head" data-reveal>
            <p className="lp-kicker">What Tripwire does</p>
            <h2 className="lp-h2">Three ways in.</h2>
          </div>
          <div className="lp-index">
            {PRODUCTS.map((p) => (
              <Link key={p.n} to={p.to} className="lp-row" data-reveal>
                <span className="lp-row-n">{p.n}</span>
                <h3 className="lp-h3">{p.title}</h3>
                <p className="lp-row-d">{p.desc}</p>
                <span className="lp-row-go">{p.go} →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── The problem: INK SLAB. Used once. ─────────────────────────── */}
      <section className="lp-sec lp-sec-tall" data-env="slab">
        <div className="lp-wrap">
          <div className="lp-split">
            <div data-reveal>
              <p className="lp-kicker">The problem</p>
              <p className="lp-lead-q">
                An agent decides what to call by reading what each tool claims to do. That text comes from the site.
                Nothing sits between the two.
              </p>
            </div>
            <div data-reveal>
              <p className="lp-small" style={{ marginBottom: 22 }}>
                A tool description is free text under the site’s control. Hide an instruction inside it and a compliant
                agent may simply follow it — no exploit, no breach, just words.
              </p>
              <p className="lp-small">
                We built a padlock for the web the moment we started typing card numbers into it. The web where agents
                act arrived without one.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why the seal holds: tint, ruled index again but 3-col ─────── */}
      <section className="lp-sec lp-sec-tall" data-env="tint">
        <div className="lp-wrap">
          <div className="lp-head" data-reveal>
            <p className="lp-kicker">Why the seal holds</p>
            <h2 className="lp-h2">A badge you cannot talk your way into.</h2>
          </div>
          <div className="lp-index">
            <div className="lp-row" data-reveal>
              <span className="lp-row-n">01</span>
              <h3 className="lp-h3">Checked by us</h3>
              <p className="lp-row-d">
                We open your page in a real browser and derive the findings ourselves. Submitting a clean self-report
                changes nothing.
              </p>
              <span />
            </div>
            <div className="lp-row" data-reveal>
              <span className="lp-row-n">02</span>
              <h3 className="lp-h3">Signed, verifiable without us</h3>
              <p className="lp-row-d">
                Ed25519 over a canonical hash. Anyone can check a report offline against our public key — no need to
                trust our word or our uptime.
              </p>
              <span />
            </div>
            <div className="lp-row" data-reveal>
              <span className="lp-row-n">03</span>
              <h3 className="lp-h3">Alive, and revocable</h3>
              <p className="lp-row-d">
                The badge re-reads your live tools on every page load. Pull your ownership proof and an hourly job
                revokes it.
              </p>
              <span />
            </div>
          </div>
        </div>
      </section>

      {/* ── Proof: paper, with the seal (the one cyan moment) ─────────── */}
      <section className="lp-sec lp-sec-tall">
        <div className="lp-wrap">
          <div className="lp-split">
            <div data-reveal>
              <p className="lp-kicker">In the wild</p>
              <h2 className="lp-h2">Live on OpenClawCity.</h2>
              <p className="lp-body" style={{ marginTop: 22 }}>
                A city where AI agents live and act. We verified the domain, opened the site ourselves, read every tool
                it exposes and signed the result — the first badge on the agent web.
              </p>
            </div>
            <div data-reveal>
              <span className="lp-seal">
                <span className="ip-dot" />
                Tripwire · verified
              </span>
              <p className="lp-fp">
                fingerprint d87dad615a4c7447043d9e909c2f578d89c9cd6d37bb915606b1cada70338415
              </p>
              <p className="lp-fp">signature Ed25519 · key k1 · re-checked hourly</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Honest scope: ACCENT BLEED. Used once, on the one claim that
             most defines the brand. ─────────────────────────────────── */}
      <section className="lp-sec lp-sec-tall" data-env="accent">
        <div className="lp-wrap">
          <div className="lp-split">
            <div data-reveal>
              <p className="lp-kicker">The honest part</p>
              <h2 className="lp-h2">What the badge does not say.</h2>
            </div>
            <div data-reveal>
              <p className="lp-small" style={{ marginBottom: 20 }}>
                We audit what a site’s tools declare, checked against the exact set present at page load. We do not
                certify server-side behaviour — it cannot be observed from the client.
              </p>
              <p className="lp-small">
                And we will never call a site “safe”, “secure” or “certified”. A badge that overclaims is worth less
                than no badge at all.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Close: paper ─────────────────────────────────────────────── */}
      <section className="lp-sec lp-sec-tall">
        <div className="lp-wrap" data-reveal>
          <h2 className="lp-display" style={{ maxWidth: '18ch' }}>
            Find out what your site tells agents.
          </h2>
          <div className="lp-links">
            <Link to="/scan" className="lp-link">
              Scan a site
            </Link>
            <Link to="/badge" className="lp-link">
              Get a badge
            </Link>
            <Link to="/range" className="lp-link">
              Test an agent
            </Link>
          </div>
        </div>
      </section>

      <div className="lp-foot">
        <span>Open source · Apache-2.0 · a DeepBlocker project</span>
        <a href="https://github.com/vincentsider/tripwire" target="_blank" rel="noopener noreferrer">
          github.com/vincentsider/tripwire
        </a>
      </div>
    </div>
  );
}
