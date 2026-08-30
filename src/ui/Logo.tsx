// src/ui/Logo.tsx
//
// The mark: a wire crossing a boundary, with the crossing point lit. It draws
// the product's function in one geometric figure — the line an agent must not
// cross, and the moment something trips it.
//
// Two strokes and a dot, on a 24px grid, in currentColor so it inherits the
// header's palette rather than carrying its own.

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block', flex: 'none' }}
    >
      {/* the boundary */}
      <path
        d="M4.5 3.5v17"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.32"
      />
      <path
        d="M19.5 3.5v17"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.32"
      />
      {/* the wire */}
      <path d="M4.5 12h15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {/* the crossing */}
      <circle cx="12" cy="12" r="3.4" fill="var(--logo-hit, #22d3ee)" />
    </svg>
  );
}
