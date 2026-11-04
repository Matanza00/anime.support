'use client';
// Article-page behaviour: reading progress bar, YouTube tap-to-play, social embed scripts,
// and one anonymous view count per browser session (feeds the bot's optimizer).
import { useEffect, useRef } from 'react';

export default function ArticleClient({ slug, scripts = [] }) {
  const bar = useRef(null);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, p)})`;
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    document.querySelectorAll('.yt').forEach((el) => {
      el.addEventListener(
        'click',
        () => {
          const f = document.createElement('iframe');
          f.src = `https://www.youtube-nocookie.com/embed/${el.dataset.yt}?autoplay=1&rel=0`;
          f.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';
          f.allowFullscreen = true;
          f.title = 'YouTube video';
          el.replaceChildren(f);
        },
        { once: true },
      );
    });

    for (const src of scripts) {
      if (document.querySelector(`script[src="${src}"]`)) continue;
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      document.body.appendChild(s);
    }

    try {
      const k = `v:${slug}`;
      if (!sessionStorage.getItem(k) && location.hostname !== 'localhost') {
        sessionStorage.setItem(k, '1');
        fetch('/api/view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }), keepalive: true }).catch(() => {});
      }
    } catch {}

    return () => removeEventListener('scroll', onScroll);
  }, [slug, scripts]);

  return <div ref={bar} className="progress" aria-hidden="true" />;
}
