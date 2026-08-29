// src/ui/useReveal.ts
//
// Scroll-reveal without a library (the site CSP is script-src 'self', and a
// landing page should not ship an animation dependency for this). One shared
// IntersectionObserver adds .in to any [data-reveal] element once it enters the
// viewport, then stops observing it — no re-entry thrash, no per-element
// observer, nothing left running after unmount.
//
// Honours prefers-reduced-motion by revealing everything immediately.

import { useEffect } from 'react';

export function useReveal(): void {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll('[data-reveal]'));
    if (nodes.length === 0) return;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      nodes.forEach((n) => n.classList.add('in'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
}
