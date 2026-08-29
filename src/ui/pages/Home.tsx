// src/ui/pages/Home.tsx
//
// The landing page, built as full-bleed TILES rather than a document with
// margins: each tile is a self-contained panel with centred type and a large
// visual, and adjacent tiles carry different grounds so the contrast does the
// work. That is the showroom pattern (Apple's grid), adapted to a product with
// no photography — the "product shot" in each tile is a rendered readout of
// Tripwire's own output.
//
// The headline states what the visitor GETS, not the product's thesis.

import { Link } from 'react-router-dom';
import '../landing.css';
import { useReveal } from '../useReveal.ts';
import { InspectionPass } from '../InspectionPass.tsx';

export function Home() {
  useReveal();

  return (
    <div className="lp">
      {/* ── HERO — ink ground, the attack shown at scale ─────────────── */}
      <section className="t t-ink">
        <div className="t-body" data-reveal>
          <p className="t-kicker">Trust layer for the agent web</p>
          <h1 className="t-h t-hero-h">Find out what your site is telling AI agents.</h1>
          <p className="t-sub">
            And whether your agent is safe on anyone else&apos;s. Tripwire reads the tools a website exposes to AI
            agents and shows you what they really say.
          </p>
          <div className="t-cta">
            <Link to="/scan" className="t-btn t-btn-fill">
              Scan a site
            </Link>
            <Link to="/badge" className="t-btn t-btn-line">
              Get a badge
            </Link>
          </div>
        </div>
        <div className="t-vis" data-reveal>
          <InspectionPass />
        </div>
      </section>

      {/* ── TWO-UP — the two sides of the product ────────────────────── */}
      <div className="t-grid">
        <section className="t t-paper">
          <div className="t-body" data-reveal>
            <p className="t-kicker">For agent builders</p>
            <h2 className="t-h">Is your agent safe on the open web?</h2>
            <p className="t-sub">Run it through a corpus of tool-surface attacks and watch, live, what it falls for.</p>
            <Link to="/range" className="t-link">
              Open the range →
            </Link>
            <div className="t-vis t-vis-sm">
              <div className="v-card" style={{ background: '#fff' }}>
                <div className="v-head">
                  <span>gauntlet</span>
                  <span>4 of 7</span>
                </div>
                <div className="v-row">
                  <span>hidden instruction</span>
                  <span className="v-tag" style={{ background: '#e1f5fa', color: '#0e7490' }}>
                    held
                  </span>
                </div>
                <div className="v-row">
                  <span>unlabelled content</span>
                  <span className="v-tag" style={{ background: '#e1f5fa', color: '#0e7490' }}>
                    held
                  </span>
                </div>
                <div className="v-row">
                  <span>lookalike tool</span>
                  <span className="v-tag" style={{ background: '#fbeae7', color: '#c0392b' }}>
                    fell
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="t t-white">
          <div className="t-body" data-reveal>
            <p className="t-kicker">For everyone</p>
            <h2 className="t-h">What does that site expose?</h2>
            <p className="t-sub">Paste any address. We open it in a real browser and read every tool it publishes.</p>
            <Link to="/scan" className="t-link">
              Scan a URL →
            </Link>
            <div className="t-vis t-vis-sm">
              <div className="v-card" style={{ background: '#fff' }}>
                <div className="v-head">
                  <span>openclawcity.ai</span>
                  <span>10 tools</span>
                </div>
                <div className="v-row">
                  <span>read_city_guide</span>
                  <span className="v-tag" style={{ background: '#e1f5fa', color: '#0e7490' }}>
                    pass
                  </span>
                </div>
                <div className="v-row">
                  <span>who_is_here</span>
                  <span className="v-tag" style={{ background: '#e1f5fa', color: '#0e7490' }}>
                    pass
                  </span>
                </div>
                <div className="v-row">
                  <span>enter_city</span>
                  <span className="v-tag" style={{ background: '#fbf1de', color: '#b7791f' }}>
                    review
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── RED TILE — the badge, the thing you display ──────────────── */}
      <section className="t t-red">
        <div className="t-body" data-reveal>
          <p className="t-kicker">For site owners</p>
          <h2 className="t-h">Prove your tools are honest.</h2>
          <p className="t-sub">
            Verify your domain, let Tripwire read your tools itself, and display a signed badge that stops applying the
            moment they change.
          </p>
          <div className="t-cta">
            <Link to="/badge" className="t-btn t-btn-fill">
              Get a badge
            </Link>
          </div>
          <div className="t-vis t-vis-sm" style={{ textAlign: 'center' }}>
            <span className="v-seal">
              <span className="v-seal-dot" />
              Tripwire · verified
            </span>
            <p className="v-fp" style={{ marginInline: 'auto' }}>
              d87dad615a4c…70338415 · Ed25519 · re-checked hourly
            </p>
          </div>
        </div>
      </section>

      {/* ── WHY IT HOLDS — paper, three ruled statements ─────────────── */}
      <section className="t t-paper" style={{ textAlign: 'left', alignItems: 'stretch' }}>
        <div className="lp-wrap" style={{ width: '100%' }}>
          <div className="lp-head" data-reveal>
            <p className="lp-kicker">Why the badge means something</p>
            <h2 className="lp-h2">A seal you cannot talk your way into.</h2>
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

      {/* ── HONEST SCOPE — ink ground, used once more at the end ─────── */}
      <section className="t t-ink">
        <div className="t-body" data-reveal>
          <p className="t-kicker">The honest part</p>
          <h2 className="t-h">What the badge does not say.</h2>
          <p className="t-sub">
            We audit what a site&apos;s tools declare, against the exact set present at page load. We do not certify
            server-side behaviour — it cannot be seen from the client. And we will never call a site “safe” or
            “certified”. A badge that overclaims is worth less than no badge at all.
          </p>
          <div className="t-cta">
            <Link to="/scan" className="t-btn t-btn-fill">
              Scan a site
            </Link>
            <Link to="/range" className="t-btn t-btn-line">
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
