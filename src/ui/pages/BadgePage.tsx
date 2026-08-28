// src/ui/pages/BadgePage.tsx
//
// Explains the badge embed and lets an operator tune its look (theme + size),
// with a live-style preview and a snippet that updates as they choose. The
// preview mirrors embed.ts's rendered pill; the real badge shows the live,
// signed verdict on the operator's own page.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CodeBlock } from '../CodeBlock.tsx';

type Theme = 'light' | 'dark' | 'auto';
type Variant = 'default' | 'compact';

// Matches embed.ts's tone→colour map and light/dark palettes.
const OK = '#0891b2';
const PALETTE = {
  light: { bg: '#ffffff', fg: '#0a0e1a', sub: '#64748b' },
  dark: { bg: '#0d121c', fg: '#f2f6fc', sub: '#94a3b8' },
};

function Preview({ theme, variant }: { theme: Theme; variant: Variant }) {
  const pal = theme === 'dark' ? PALETTE.dark : PALETTE.light;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        font: '500 12px/1.2 ui-sans-serif, system-ui, sans-serif',
        border: `1px solid ${OK}33`,
        borderRadius: 8,
        padding: '6px 10px',
        background: pal.bg,
        color: pal.fg,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: OK, flex: 'none' }} />
      <span style={{ color: OK, fontWeight: 600 }}>Tripwire: verified</span>
      {variant === 'default' && <span style={{ color: pal.sub }}>tools match audit</span>}
    </span>
  );
}

export function BadgePage() {
  const apiBase = location.origin;
  const [theme, setTheme] = useState<Theme>('light');
  const [variant, setVariant] = useState<Variant>('default');
  const [origin, setOrigin] = useState('https://your-site.com');
  const [mount, setMount] = useState('');

  const attrs = [
    `        data-origin="${origin || 'https://your-site.com'}"`,
    theme !== 'light' ? `        data-theme="${theme}"` : '',
    variant !== 'default' ? `        data-variant="${variant}"` : '',
    mount.trim() ? `        data-mount="${mount.trim()}"` : '',
  ].filter(Boolean);
  const snippet = `<script src="${apiBase}/badge.js"\n${attrs.join('\n')}></script>`;

  return (
    <div className="page page-narrow">
      <div className="eyebrow-lg">Mode 2 · the badge</div>
      <h1 style={{ fontSize: 30, letterSpacing: '-0.02em', margin: '0 0 10px' }}>How the badge works</h1>
      <p className="muted" style={{ marginBottom: 22 }}>
        The badge is a single line of HTML you paste into your page. It runs on your site, fetches your
        signed audit, reads your live tools, and renders a verdict. If your tools change or your ownership
        proof disappears, it stops showing green — it can never claim more than the truth.
        Don't have a badge yet? <Link to="/badge">Get one first</Link>.
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>Preview</div>
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            padding: '26px 0',
            borderRadius: 10,
            background:
              theme === 'dark'
                ? 'repeating-linear-gradient(45deg,#0a0e17,#0a0e17 10px,#0c1120 10px,#0c1120 20px)'
                : 'repeating-linear-gradient(45deg,#e9edf3,#e9edf3 10px,#f2f5f9 10px,#f2f5f9 20px)',
          }}
        >
          <Preview theme={theme} variant={variant} />
        </div>

        <div className="row" style={{ marginTop: 16, gap: 24 }}>
          <div>
            <div className="muted-3" style={{ fontSize: 12, marginBottom: 4 }}>Theme</div>
            <div className="seg">
              {(['light', 'dark', 'auto'] as Theme[]).map((t) => (
                <button key={t} className={theme === t ? 'on' : ''} onClick={() => setTheme(t)} type="button">
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="muted-3" style={{ fontSize: 12, marginBottom: 4 }}>Size</div>
            <div className="seg">
              {(['default', 'compact'] as Variant[]).map((v) => (
                <button key={v} className={variant === v ? 'on' : ''} onClick={() => setVariant(v)} type="button">
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <label className="card-title" htmlFor="badge-origin" style={{ display: 'block', marginBottom: 8 }}>
          Your domain
        </label>
        <input
          id="badge-origin"
          className="field"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          spellCheck={false}
          autoCapitalize="none"
        />
        <label className="card-title" htmlFor="badge-mount" style={{ display: 'block', margin: '16px 0 8px' }}>
          Where it appears <span className="muted-3" style={{ fontWeight: 400 }}>(optional)</span>
        </label>
        <input
          id="badge-mount"
          className="field"
          placeholder="#tripwire-badge   (a CSS selector — leave blank for inline)"
          value={mount}
          onChange={(e) => setMount(e.target.value)}
          spellCheck={false}
          autoCapitalize="none"
        />
        <p className="muted-3" style={{ fontSize: 12.5, margin: '8px 0 0' }}>
          Leave blank and the badge appears inline, right where you paste the line — perfect for a page footer
          or an About page. For a full-screen app (a 3D/2D world, a canvas UI), make a container where you want
          it and name it here — e.g. <span className="mono">#tripwire-badge</span> for a fixed corner:
        </p>
        <CodeBlock
          code={'<div id="tripwire-badge"\n     style="position:fixed;bottom:12px;right:12px;z-index:9999"></div>'}
          label="mount container"
        />

        <p className="muted" style={{ margin: '14px 0 0' }}>Paste this where you want the badge to appear:</p>
        <CodeBlock code={snippet} label="badge embed" />
      </div>

      <div className="notice">
        <strong style={{ color: 'var(--ink)' }}>What you can and can't change.</strong> You can restyle the
        badge's theme and size. You cannot change the <em>verdict</em>: the label and colour always come from
        the live, signed check, and the badge renders inside a shadow DOM so your page's CSS can't repaint a
        warning green. That is the point — a badge only ever says what's true.
      </div>
    </div>
  );
}
