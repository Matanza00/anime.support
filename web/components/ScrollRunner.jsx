'use client';
// Scroll-driven pencil swordsman (see lib/scroll-runner.js). Desktop only, and off for reduced motion.
import { useEffect, useRef } from 'react';

export default function ScrollRunner() {
  const ref = useRef(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.innerWidth < 1180) return;
    let stop = () => {};
    let cancelled = false;
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 900));
    const id = idle(async () => {
      const { start } = await import('@/lib/scroll-runner');
      if (cancelled || !ref.current) return;
      stop = start(ref.current, { hero: document.querySelector('.home-hero'), logo: document.querySelector('footer img') });
    });
    return () => {
      cancelled = true;
      (window.cancelIdleCallback || clearTimeout)(id);
      stop();
    };
  }, []);
  return <canvas ref={ref} className="scroll-runner" aria-hidden="true" />;
}
