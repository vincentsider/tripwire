// src/ui/pages/Home.tsx
//
// The landing page. Explains Tripwire in one breath, then sends the visitor down
// one of three clear paths. Deliberately plain-language: a non-technical site
// operator should know within seconds which door is theirs.

import { Link } from 'react-router-dom';

export function Home() {
  return (
    <div className="page">
      <section className="hero">
        <div className="eyebrow-lg">A DeepBlocker project · open source</div>
        <h1>
          Trust, for the web where <span className="hero-accent">agents</span> act.
        </h1>
        <p className="lead">
          Websites are starting to offer tools that AI agents can use — book, pay, post, fetch. Tripwire
          is the trust layer for that new web. It checks a site's agent tools and issues a live,
          revocable badge, the way the padlock in your browser vouches for a secure connection.
        </p>
      </section>

      <div className="choices">
        <Link to="/range" className="choice">
          <span className="choice-ico" aria-hidden>🎯</span>
          <h3>Test an agent</h3>
          <p>Run your AI agent through a range of tool-surface traps and watch, live, what it falls for. Every payload is a harmless marker.</p>
          <span className="go">Open the range →</span>
        </Link>

        <Link to="/badge" className="choice">
          <span className="choice-ico" aria-hidden>🛡️</span>
          <h3>Get a badge for your site</h3>
          <p>Prove you own your domain, let Tripwire check your tools, and get a live badge to display. Guided, no code required.</p>
          <span className="go">Start onboarding →</span>
        </Link>

        <Link to="/scan" className="choice">
          <span className="choice-ico" aria-hidden>🔎</span>
          <h3>Scan any site</h3>
          <p>Paste a web address. Tripwire opens it in a real browser, reads its agent tools, and shows you what they declare and any red flags.</p>
          <span className="go">Scan a URL →</span>
        </Link>
      </div>

      <hr className="divider" />

      <section>
        <div className="eyebrow-lg">How the badge works</div>
        <h2 className="sec">Three plain steps, honestly checked</h2>
        <div className="steps" style={{ marginTop: 18 }}>
          <div className="step done">
            <div className="stepnum">1</div>
            <div className="step-body">
              <h3>You prove you own the site</h3>
              <p className="muted" style={{ margin: 0 }}>
                We give you a one-line code to place on your domain (a small file, or a DNS record).
                Tripwire fetches it itself to confirm — no one can claim a site they don't control.
              </p>
            </div>
          </div>
          <div className="step done">
            <div className="stepnum">2</div>
            <div className="step-body">
              <h3>Tripwire checks your tools itself</h3>
              <p className="muted" style={{ margin: 0 }}>
                Our server opens your site in a real browser, reads your agent tools, and analyses them.
                It never just trusts a form you submit — it re-derives everything and signs the result.
              </p>
            </div>
          </div>
          <div className="step done">
            <div className="stepnum">3</div>
            <div className="step-body">
              <h3>You display a live badge</h3>
              <p className="muted" style={{ margin: 0 }}>
                Paste one line into your page. The badge re-checks your live tools every time a visitor
                loads it. If your tools change or the proof disappears, it stops showing green — it can
                never lie on your behalf.
              </p>
            </div>
          </div>
        </div>
      </section>

      <hr className="divider" />

      <section className="page-narrow" style={{ margin: 0, padding: 0 }}>
        <div className="eyebrow-lg">What a badge does and does not say</div>
        <p className="muted">
          Tripwire audits a site's agent-tool <strong>surface</strong>: what the tools declare, and — where
          the owner allows it — what they observably do from the browser. It is verified live against the
          exact tools present at page load; if they change, the seal stops applying. It does <strong>not</strong>{' '}
          certify server-side behaviour, which can't be seen from the outside. A scan of a site you don't own
          is an observation, never a certificate.
        </p>
      </section>
    </div>
  );
}
