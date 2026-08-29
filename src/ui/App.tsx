// src/ui/App.tsx
//
// The site layout: a sticky nav, the routed page (Outlet), and a shared footer.
// Each section (range, badge, scan, embed) is its own page under src/ui/pages.

import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { Nav } from './Nav.tsx';

export function App() {
  // The landing page is full-bleed and carries its own footer.
  const isLanding = useLocation().pathname === '/';
  return (
    <>
      <Nav />
      <main>
        <Outlet />
      </main>
      {!isLanding && (
        <footer style={{ borderTop: '1px solid var(--hair)' }}>
          <div
            className="page"
            style={{ paddingTop: 18, paddingBottom: 28, fontSize: 12, color: 'var(--ink-3)', display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'space-between' }}
          >
            <span>Open source (Apache-2.0). Inert payloads only — see SECURITY.md. A DeepBlocker project.</span>
            <a href="https://github.com/vincentsider/tripwire" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ink-2)' }}>
              github.com/vincentsider/tripwire
            </a>
          </div>
        </footer>
      )}
      <ScrollRestoration />
    </>
  );
}
