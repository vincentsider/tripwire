// src/ui/Nav.tsx
//
// The top navigation shared by every page. Links use NavLink so the active
// section is highlighted. The GitHub link is the one outbound link (the project
// is open source).

import { NavLink, useLocation } from 'react-router-dom';

const GITHUB = 'https://github.com/vincentsider/tripwire';

export function Nav() {
  // The landing is light editorial; the console pages stay dark. The nav is
  // shared, so it takes its palette from the route rather than being duplicated.
  const light = useLocation().pathname === '/';
  return (
    <nav className={`nav${light ? ' nav-light' : ''}`}>
      <div className="nav-inner">
        <NavLink to="/" className="brand">
          <span className="brand-mark" aria-hidden />
          Tripwire
        </NavLink>
        <div className="nav-links">
          <NavLink to="/range" className="nav-link">
            Test an agent
          </NavLink>
          <NavLink to="/badge" className="nav-link">
            Get a badge
          </NavLink>
          <NavLink to="/scan" className="nav-link">
            Scan a site
          </NavLink>
          <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="nav-link">
            GitHub
          </a>
        </div>
      </div>
    </nav>
  );
}
