// src/ui/pages/ScanPage.tsx
//
// Mode 2, consumer side: paste any URL and get an UNSIGNED preview of its WebMCP
// tool surface + red flags. This is the "an agent (or you) checks a site" path —
// no ownership needed, because it makes no claim on the site's behalf.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { scanUrl, type ScanResult } from '../../data/api.ts';
import { FindingsList } from '../FindingsList.tsx';

const ERR: Record<string, string> = {
  scan_unavailable: 'Scanning is not switched on for this deployment yet.',
  scan_failed: "The browser couldn't finish reading that page. Try again.",
  nav_failed: "That page couldn't be opened (it may be down or blocking robots).",
  scan_bad_surface: 'That page exposes agent tools, but they were malformed.',
  rate_limited: 'Too many scans just now — give it a minute.',
  invalid: 'That does not look like a valid web address (include https://).',
};

export function ScanPage() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const { ok, data } = await scanUrl(withScheme);
    setBusy(false);
    if (!ok || !data) {
      setError(ERR[data?.error ?? 'scan_failed'] ?? data?.error ?? ERR.scan_failed!);
      return;
    }
    setResult(data);
  };

  return (
    <div className="page page-narrow">
      <div className="eyebrow-lg">Mode 2 · scan a site</div>
      <h1 style={{ fontSize: 30, letterSpacing: '-0.02em', margin: '0 0 10px' }}>Scan any site's agent tools</h1>
      <p className="muted" style={{ marginBottom: 22 }}>
        Paste a web address. Tripwire opens it in a real headless browser, reads whatever WebMCP tools it
        exposes, and reports them with any red flags. This is a look, not a certificate — a signed badge
        requires the owner to prove control (<Link to="/badge">get a badge</Link>).
      </p>

      <form onSubmit={submit} className="row" style={{ marginBottom: 8 }}>
        <input
          className="field"
          style={{ flex: '1 1 320px' }}
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
        />
        <button className="btn btn-primary" type="submit" disabled={busy || !url.trim()}>
          {busy ? 'Scanning…' : 'Scan'}
        </button>
      </form>
      <p className="muted-3" style={{ fontSize: 12.5, marginTop: 0 }}>
        Try the demo surface:{' '}
        <button
          type="button"
          className="linklike"
          onClick={() => setUrl(`${location.origin}/demo-webmcp`)}
          style={{ background: 'none', border: 0, color: 'var(--signal-bright)', cursor: 'pointer', padding: 0, font: 'inherit' }}
        >
          {location.origin}/demo-webmcp
        </button>
      </p>

      {busy && (
        <div className="notice" style={{ marginTop: 18 }}>
          <span className="spin" style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Opening the page in a browser and reading its tools — this can take a few seconds.
        </div>
      )}

      {error && (
        <div className="notice bad" style={{ marginTop: 18 }}>
          {error}
        </div>
      )}

      {result && !busy && (
        <div className="card" style={{ marginTop: 20 }}>
          {result.host === 'none' ? (
            <div>
              <div className="card-title" style={{ marginBottom: 6 }}>No agent tools found</div>
              <p className="muted" style={{ margin: 0 }}>
                Tripwire opened <span className="mono" style={{ fontSize: 12 }}>{result.origin}</span> but found no
                WebMCP tools an outside visitor can see. Some sites only expose tools inside a native agent host.
              </p>
            </div>
          ) : (
            <div>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                <div className="card-title">Scan result · unsigned preview</div>
                <span className="pill pill-idle">{result.tools} tool{result.tools === 1 ? '' : 's'}</span>
              </div>
              <p className="muted-3" style={{ fontSize: 12, margin: '0 0 6px' }}>
                <span className="mono">{result.origin}</span>
              </p>
              <FindingsList findings={result.findings} />
              {result.fingerprint && (
                <p className="muted-3" style={{ fontSize: 11.5, marginTop: 12, wordBreak: 'break-all' }}>
                  surface fingerprint <span className="mono">{result.fingerprint}</span>
                </p>
              )}
              <p className="notice" style={{ marginTop: 12, fontSize: 12 }}>{result.note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
