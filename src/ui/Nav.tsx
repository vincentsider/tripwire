// src/ui/Nav.tsx
//
// The top navigation shared by every page. Links use NavLink so the active
// section is highlighted. The GitHub link is the one outbound link (the project
// is open source).

import { NavLink } from 'react-router-dom';

const GITHUB = 'https://github.com/vincentsider/tripwire';

export function Nav() {
  return (
    <nav className="nav">
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
