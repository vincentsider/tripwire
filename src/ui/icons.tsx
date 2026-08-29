// src/ui/icons.tsx
//
// Line icons drawn on a 24px grid, 1.5 stroke, currentColor. Deliberately not
// emoji: emoji render differently on every OS, carry someone else's visual
// language, and read as a placeholder on a product page.

type P = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

/** Concentric rings + centre: the range — put an agent under test. */
export function IconTarget({ size = 22 }: P) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Shield with a check: the badge — an audited, vouched-for surface. */
export function IconShield({ size = 22 }: P) {
  return (
    <svg {...base(size)}>
      <path d="M12 2.75 4.75 5.9v5.4c0 4.3 2.9 8.3 7.25 9.95 4.35-1.65 7.25-5.65 7.25-9.95V5.9Z" />
      <path d="m9 11.8 2.2 2.2 4-4.2" />
    </svg>
  );
}

/** Magnifier over a horizon line: scan a site you do not own. */
export function IconScan({ size = 22 }: P) {
  return (
    <svg {...base(size)}>
      <circle cx="11" cy="11" r="6.25" />
      <path d="M4.75 11h12.5" />
      <path d="M15.6 15.6 20 20" />
    </svg>
  );
}

/** Fingerprint arcs: the surface fingerprint the badge binds to. */
export function IconFingerprint({ size = 22 }: P) {
  return (
    <svg {...base(size)}>
      <path d="M12 5.5c-3.6 0-6.5 2.9-6.5 6.5v3" />
      <path d="M18.5 12c0-3.6-2.9-6.5-6.5-6.5" />
      <path d="M8.75 12a3.25 3.25 0 0 1 6.5 0v4.25" />
      <path d="M12 12v5.5" />
      <path d="M18.5 15v2.5" />
    </svg>
  );
}

/** Key: the signature that makes a report verifiable offline. */
export function IconKey({ size = 22 }: P) {
  return (
    <svg {...base(size)}>
      <circle cx="8" cy="12" r="3.75" />
      <path d="M11.75 12H20" />
      <path d="M17 12v3" />
      <path d="M20 12v2.25" />
    </svg>
  );
}

/** Slashed circle: revocation — the badge can be switched off. */
export function IconRevoke({ size = 22 }: P) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6.4 6.4 11.2 11.2" />
    </svg>
  );
}

/** Arrow: link affordance. */
export function IconArrow({ size = 16 }: P) {
  return (
    <svg {...base(size)}>
      <path d="M5 12h13" />
      <path d="m12.5 6.5 5.5 5.5-5.5 5.5" />
    </svg>
  );
}
