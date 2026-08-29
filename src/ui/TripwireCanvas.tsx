// src/ui/TripwireCanvas.tsx
//
// The hero visual: a taut wire, and traffic drifting across it. Most of it
// passes cleanly; every so often something crosses the line and the wire trips —
// a bloom of light at the point of contact that fades away.
//
// It is the product's own metaphor rather than decoration, and it stays inside
// the page's rules: monochrome, one thin line, nothing boxed. Hand-written 2D
// canvas because the site CSP is script-src 'self' — no animation library.
//
// Hygiene: one rAF loop that is cancelled on unmount, paused when the tab is
// hidden or the canvas is scrolled out of view, DPR-aware and capped at 2, and
// a debounced resize. Under prefers-reduced-motion it paints a single static
// frame and never starts the loop.

import { useEffect, useRef } from 'react';

interface Mote {
  x: number;
  y: number;
  vx: number;
  r: number;
  a: number;
  /** true once this mote has been counted as having crossed the wire */
  tripped: boolean;
}

interface Bloom {
  x: number;
  /** 0 → 1 life */
  t: number;
}

const MOTES = 26;
const BLOOM_MS = 1500;

export function TripwireCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
    let running = false;
    const motes: Mote[] = [];
    const blooms: Bloom[] = [];

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    function seed() {
      motes.length = 0;
      for (let i = 0; i < MOTES; i++) {
        // A few motes ride close to the wire — those are the ones that trip it.
        const nearWire = i % 5 === 0;
        const spread = nearWire ? 6 : h * 0.42;
        motes.push({
          x: Math.random() * w,
          y: h / 2 + (Math.random() - 0.5) * 2 * spread,
          vx: 6 + Math.random() * 16,
          r: nearWire ? 1.5 : 1,
          a: nearWire ? 0.5 : 0.12 + Math.random() * 0.16,
          tripped: false,
        });
      }
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      // Always paint one static frame, so the canvas is never blank before the
      // loop starts — it may not start for a while if the page was opened in a
      // background tab, and it never starts under reduced motion.
      draw(0);
    }

    function draw(dt: number) {
      const wireY = h / 2;
      ctx!.clearRect(0, 0, w, h);

      // The wire: 1px, fading out at both ends so it reads as taut, not boxed.
      const grad = ctx!.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.08, 'rgba(255,255,255,0.13)');
      grad.addColorStop(0.92, 'rgba(255,255,255,0.13)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, wireY, w, 1);

      // Traffic.
      for (const m of motes) {
        if (dt) {
          m.x += m.vx * dt;
          if (m.x > w + 20) {
            m.x = -20;
            m.tripped = false;
          }
        }
        const onWire = Math.abs(m.y - wireY) < 3;
        if (onWire && !m.tripped && m.x > 0 && m.x < w && dt) {
          m.tripped = true;
          blooms.push({ x: m.x, t: 0 });
          if (blooms.length > 6) blooms.shift();
        }
        ctx!.beginPath();
        ctx!.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255,255,255,${m.a})`;
        ctx!.fill();
      }

      // Blooms: where something crossed the line.
      for (let i = blooms.length - 1; i >= 0; i--) {
        const b = blooms[i]!;
        if (dt) b.t += (dt * 1000) / BLOOM_MS;
        if (b.t >= 1) {
          blooms.splice(i, 1);
          continue;
        }
        const fade = 1 - b.t;
        const spread = 40 + b.t * 190;

        // Light spilling along the wire from the contact point.
        const g = ctx!.createLinearGradient(b.x - spread, 0, b.x + spread, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, `rgba(255,255,255,${0.5 * fade})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx!.fillStyle = g;
        ctx!.fillRect(b.x - spread, wireY - 0.5, spread * 2, 2);

        // A soft halo at the point of contact.
        const rg = ctx!.createRadialGradient(b.x, wireY, 0, b.x, wireY, 26 + b.t * 34);
        rg.addColorStop(0, `rgba(255,255,255,${0.22 * fade})`);
        rg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx!.fillStyle = rg;
        ctx!.fillRect(b.x - 70, wireY - 70, 140, 140);
      }
    }

    function frame(now: number) {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      draw(dt);
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running || reduce) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    resize();

    // Only animate while actually on screen.
    const io = new IntersectionObserver((es) => (es[0]?.isIntersecting ? start() : stop()), { threshold: 0 });
    io.observe(canvas);

    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);

    let rt: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(rt);
      rt = setTimeout(resize, 150);
    };
    window.addEventListener('resize', onResize);

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', onResize);
      clearTimeout(rt);
    };
  }, []);

  return <canvas ref={ref} className="lp-canvas" aria-hidden="true" />;
}
