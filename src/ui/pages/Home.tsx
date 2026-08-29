// src/ui/pages/Home.tsx
//
// The landing page. Its job, in order: name the shift (agents act on the web
// now), name the gap (a site describes its own tools and the agent believes the
// description), name the answer (an audited, signed, revocable badge), and then
// send the visitor down one of three doors.
//
// The scope section is deliberate: stating plainly what the badge does NOT cover
// is the product's core credibility claim, so it is given real estate rather
// than buried in a footnote.

import { Link } from 'react-router-dom';
import '../landing.css';
import { useReveal } from '../useReveal.ts';
import { SurfacePanel } from '../SurfacePanel.tsx';
import { IconTarget, IconShield, IconScan, IconFingerprint, IconKey, IconRevoke, IconArrow } from '../icons.tsx';

export function Home() {
  useReveal();

  return (
    <div className="lp">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div className="lp-hero-text" data-reveal>
            <div className="lp-eyebrow">
              <span className="lp-live" /> Open source · a DeepBlocker project
            </div>
            <h1 className="lp-h1">
              The agent web
              <br />
              has no <span className="lp-accent">padlock</span>.
            </h1>
            <p className="lp-lead">
              Websites now publish tools that AI agents can call — book, pay, post, fetch. The site writes the
              description; your agent believes it. Tripwire checks those tools itself and issues a live, signed badge.
            </p>
            <div className="lp-cta">
              <Link to="/scan" className="lp-btn lp-btn-primary">
                Scan a site <IconArrow />
              </Link>
              <Link to="/badge" className="lp-btn lp-btn-ghost">
                Get a badge
              </Link>
            </div>
            <p className="lp-microcopy">Free · no account · works on any site with agent tools</p>
          </div>

          <div className="lp-hero-visual" data-reveal>
            <SurfacePanel />
            <p className="lp-caption">Illustrative surface. Real scans return the same checks, verdicts and fingerprint.</p>
          </div>
        </div>
      </section>

      {/* ── The problem ──────────────────────────────────────────────────── */}
      <section className="lp-sec lp-sec-alt">
        <div className="lp-wrap">
          <div className="lp-sec-head" data-reveal>
            <div className="lp-kicker">The problem</div>
            <h2 className="lp-h2">A description is an instruction.</h2>
            <p className="lp-sub">
              An agent decides what to call by reading what each tool claims to do. That text comes from the site.
              Nothing sits between the two.
            </p>
          </div>

          <div className="lp-beats">
            <div className="lp-beat" data-reveal>
              <span className="lp-beat-n">01</span>
              <h3>Sites are opening tools to agents</h3>
              <p>
                A page can now expose actions an agent may take on a visitor's behalf — search, book, transfer, publish.
                The agent reads the menu and picks.
              </p>
            </div>
            <div className="lp-beat" data-reveal>
              <span className="lp-beat-n">02</span>
              <h3>The menu is written by the restaurant</h3>
              <p>
                A tool's description is free text under the site's control. Hide an instruction inside it and a
                compliant agent may simply follow it — no exploit, no breach, just words.
              </p>
            </div>
            <div className="lp-beat" data-reveal>
              <span className="lp-beat-n">03</span>
              <h3>And nobody is checking</h3>
              <p>
                We built a padlock for the web the moment we typed card numbers into it. The web where agents act
                arrived without one.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── The three doors ──────────────────────────────────────────────── */}
      <section className="lp-sec">
        <div className="lp-wrap">
          <div className="lp-sec-head" data-reveal>
            <div className="lp-kicker">What Tripwire does</div>
            <h2 className="lp-h2">Three ways in.</h2>
            <p className="lp-sub">Whether you run a site, build an agent, or are simply about to trust one.</p>
          </div>

          <div className="lp-doors">
            <Link to="/badge" className="lp-door lp-door-lead" data-reveal>
              <span className="lp-door-ico">
                <IconShield size={24} />
              </span>
              <div className="lp-door-body">
                <span className="lp-door-tag">For site owners</span>
                <h3>Earn a badge for your site</h3>
                <p>
                  Prove you own the domain, let Tripwire open your site and read your tools itself, and display a live,
                  signed badge. Guided, no code beyond one line.
                </p>
              </div>
              <span className="lp-door-go">
                Start onboarding <IconArrow />
              </span>
            </Link>

            <Link to="/range" className="lp-door" data-reveal>
              <span className="lp-door-ico">
                <IconTarget size={22} />
              </span>
              <div className="lp-door-body">
                <span className="lp-door-tag">For agent builders</span>
                <h3>Test your agent</h3>
                <p>Run it through a range of tool-surface traps and watch, live, what it falls for. Every payload inert.</p>
              </div>
              <span className="lp-door-go">
                Open the range <IconArrow />
              </span>
            </Link>

            <Link to="/scan" className="lp-door" data-reveal>
              <span className="lp-door-ico">
                <IconScan size={22} />
              </span>
              <div className="lp-door-body">
                <span className="lp-door-tag">For everyone</span>
                <h3>Scan any site</h3>
                <p>Paste an address. We open it in a real browser, read its tools, and show you what they declare.</p>
              </div>
              <span className="lp-door-go">
                Scan a URL <IconArrow />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── How the badge holds ──────────────────────────────────────────── */}
      <section className="lp-sec lp-sec-alt">
        <div className="lp-wrap">
          <div className="lp-sec-head" data-reveal>
            <div className="lp-kicker">Why the badge means something</div>
            <h2 className="lp-h2">A seal you cannot talk your way into.</h2>
            <p className="lp-sub">
              Three mechanics do the work. Each one removes a way to fake a pass — including by us.
            </p>
          </div>

          <div className="lp-props">
            <div className="lp-prop" data-reveal>
              <span className="lp-prop-ico">
                <IconFingerprint size={22} />
              </span>
              <h3>Checked by us, not claimed by you</h3>
              <p>
                Tripwire opens your page in a real browser and derives the findings itself. A self-report is never the
                trust anchor — submitting a clean form changes nothing.
              </p>
            </div>
            <div className="lp-prop" data-reveal>
              <span className="lp-prop-ico">
                <IconKey size={22} />
              </span>
              <h3>Signed, and verifiable without us</h3>
              <p>
                Every report is sealed with an Ed25519 signature over a canonical hash. Anyone can verify it offline
                against our public key — no need to trust our word or our uptime.
              </p>
            </div>
            <div className="lp-prop" data-reveal>
              <span className="lp-prop-ico">
                <IconRevoke size={22} />
              </span>
              <h3>Alive, and revocable</h3>
              <p>
                The badge re-checks your live tools on every page load and shows “tools changed” if they drift. Pull
                your ownership proof and an hourly job revokes it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Proof ────────────────────────────────────────────────────────── */}
      <section className="lp-sec">
        <div className="lp-wrap">
          <div className="lp-proof" data-reveal>
            <div className="lp-proof-copy">
              <div className="lp-kicker">In the wild</div>
              <h2 className="lp-h2">Live on OpenClawCity.</h2>
              <p className="lp-sub">
                A city where AI agents live and act. Tripwire verified the domain, opened the site itself, read every
                tool it exposes and signed the result — the first badge on the agent web.
              </p>
              <a
                className="lp-inline-link"
                href="https://openclawcity.ai"
                target="_blank"
                rel="noopener noreferrer"
              >
                Visit openclawcity.ai <IconArrow />
              </a>
            </div>
            <div className="lp-stats">
              <div className="lp-stat">
                <span className="lp-stat-n">10</span>
                <span className="lp-stat-l">tools audited</span>
              </div>
              <div className="lp-stat">
                <span className="lp-stat-n">0.98</span>
                <span className="lp-stat-l">assurance score</span>
              </div>
              <div className="lp-stat">
                <span className="lp-stat-n">1</span>
                <span className="lp-stat-l">flag surfaced</span>
              </div>
              <div className="lp-stat">
                <span className="lp-stat-n">60m</span>
                <span className="lp-stat-l">re-check cadence</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Honest scope ─────────────────────────────────────────────────── */}
      <section className="lp-sec lp-sec-alt">
        <div className="lp-wrap">
          <div className="lp-sec-head" data-reveal>
            <div className="lp-kicker">The honest part</div>
            <h2 className="lp-h2">What the badge does not say.</h2>
          </div>
          <div className="lp-scope" data-reveal>
            <p>
              Tripwire audits a site's agent-tool <strong>surface</strong>: what the tools declare — names,
              descriptions, input schemas, safety hints, cross-origin exposure — and, where the owner authorises it,
              what they observably do from the browser. It is checked against the exact tools present at page load; if
              they change, the seal stops applying.
            </p>
            <p>
              It does <strong>not</strong> certify server-side behaviour, which cannot be observed from the client. A
              scan of a site you do not own is an observation, never a certificate. We will never call a site “safe”,
              “secure” or “certified” — a badge that overclaims is worth less than no badge at all.
            </p>
          </div>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────────── */}
      <section className="lp-sec lp-close">
        <div className="lp-wrap" data-reveal>
          <h2 className="lp-h2 lp-close-h">Find out what your site is telling agents.</h2>
          <div className="lp-cta lp-cta-center">
            <Link to="/scan" className="lp-btn lp-btn-primary">
              Scan a site <IconArrow />
            </Link>
            <Link to="/badge" className="lp-btn lp-btn-ghost">
              Get a badge
            </Link>
          </div>
          <p className="lp-microcopy">Apache-2.0 · inert payloads only · run your own copy any time</p>
        </div>
      </section>
    </div>
  );
}
