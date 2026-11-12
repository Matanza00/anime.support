'use client';
// Faint pencil-sketch sword fight behind the page (original characters, drawn in code: no video to download).
// Starts after the page has loaded, animates at 12 fps, and shows a single still frame on phones and for
// visitors who prefer reduced motion.
import { useEffect, useRef } from 'react';

export default function SketchFight() {
  const ref = useRef(null);
  useEffect(() => {
    let stop = () => {};
    let cancelled = false;
    const go = async () => {
      const { start } = await import('@/lib/sketch-fight');
      if (cancelled || !ref.current) return;
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.innerWidth < 760;
      stop = start(ref.current, { still });
      ref.current.classList.add('on');
    };
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 800));
    const id = idle(go);
    return () => {
      cancelled = true;
      (window.cancelIdleCallback || clearTimeout)(id);
      stop();
    };
  }, []);
  return <canvas ref={ref} className="sketch-fight" aria-hidden="true" />;
}
