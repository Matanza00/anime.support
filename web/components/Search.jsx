'use client';
// Instant search over a small JSON index generated at build time (/search-index.json).
import { useEffect, useMemo, useState } from 'react';

export default function Search() {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    const p = new URLSearchParams(location.search).get('q');
    if (p) setQ(p);
    fetch('/search-index.json').then((r) => r.json()).then(setItems).catch(() => setItems([]));
  }, []);

  const results = useMemo(() => {
    if (!items) return [];
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return items.slice(0, 12);
    return items
      .map((it) => {
        const hay = `${it.t} ${it.a.join(' ')} ${it.e}`.toLowerCase();
        const score = words.reduce((s, w) => s + (it.t.toLowerCase().includes(w) ? 3 : hay.includes(w) ? 1 : -99), 0);
        return { it, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((r) => r.it);
  }, [items, q]);

  return (
    <div>
      <label htmlFor="q" className="sr-only">Search anime news</label>
      <input id="q" className="search-box" type="search" placeholder="Search anime, shows, news…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <p className="meta" style={{ margin: '12px 4px' }} aria-live="polite">
        {items === null ? 'Loading…' : q ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Latest stories'}
      </p>
      <div className="stack">
        {results.map((r) => (
          <a key={r.s} className="row-card glass" href={`/news/${r.s}/`} style={{ gridTemplateColumns: '1fr' }}>
            <div>
              <h3>{r.t}</h3>
              <p className="meta" style={{ marginTop: 6 }}>{r.e}</p>
            </div>
          </a>
        ))}
        {items && q && !results.length && <div className="glass empty">No stories match “{q}”. Try a shorter word or an anime title.</div>}
      </div>
    </div>
  );
}
