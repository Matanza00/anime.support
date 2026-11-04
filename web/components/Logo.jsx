'use client';
// Shows the crisp static logo first (fast paint), then plays the animated logo once.
// Hovering or focusing the logo replays the animation. Respects "reduce motion".
import { useEffect, useRef } from 'react';

const STATIC = '/brand/logo-dark.svg';
const ANIM = '/brand/logo-anim.webp';

export default function Logo() {
  const img = useRef(null);
  const ok = useRef(false);

  const play = () => {
    if (!ok.current || !img.current) return;
    img.current.src = `${ANIM}?r=${Date.now()}`; // new URL restarts the one-shot animation
  };

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const pre = new Image();
    pre.onload = () => {
      ok.current = true;
      play();
    };
    pre.src = ANIM;
  }, []);

  return (
    <a className="logo" href="/" aria-label="anime.support home" onMouseEnter={play} onFocus={play}>
      <img id="site-logo" ref={img} src={STATIC} alt="anime.support" width={128} height={52} />
    </a>
  );
}
