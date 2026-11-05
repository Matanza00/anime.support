'use client';
// Cloudflare Turnstile "I am human" check. Renders nothing until a site key is configured.
import { useEffect, useRef } from 'react';

export const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

let loader;
function load() {
  loader ||= new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = resolve;
    document.head.appendChild(s);
  });
  return loader;
}

export default function Turnstile({ onToken }) {
  const box = useRef(null);
  useEffect(() => {
    if (!TURNSTILE_KEY) return;
    let id;
    load().then(() => {
      if (box.current && window.turnstile) id = window.turnstile.render(box.current, { sitekey: TURNSTILE_KEY, theme: 'dark', callback: onToken, 'expired-callback': () => onToken('') });
    });
    return () => id && window.turnstile?.remove(id);
  }, [onToken]);
  return TURNSTILE_KEY ? <div ref={box} className="turnstile" /> : null;
}
