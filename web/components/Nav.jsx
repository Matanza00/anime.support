'use client';
// Main menu: five items, with related pages grouped in drop-downs.
// Desktop: menus open on hover or click (Escape / outside click closes). Phone: one ☰ button opens a panel
// with every group listed.
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const MENU = [
  {
    key: 'news', label: 'News',
    links: [
      ['/news/', 'Latest news', 'Every confirmed announcement'],
      ['/upcoming/', 'Upcoming', 'New seasons, films and dates announced'],
      ['/releases/', 'Out now', 'Episodes and films you can watch today'],
      ['/features/', 'Features & guides', 'Watch orders and where to watch'],
    ],
  },
  {
    key: 'anime', label: 'Anime',
    links: [
      ['/anime/', 'Anime A–Z', 'Every show: episodes, trailers, streaming'],
      ['/season/', 'Seasonal chart', 'All the new anime this season'],
      ['/donghua/', 'Donghua', 'Chinese anime with English subs'],
    ],
  },
  {
    key: 'schedule', label: 'Schedule',
    links: [
      ['/schedule/', 'Airing schedule', 'This week’s episodes in your time zone'],
      ['/calendar/', 'Release calendar', 'Premiere dates for the months ahead'],
    ],
  },
  { key: 'top', label: 'Top 10', href: '/top/' },
  { key: 'contests', label: 'Contests', href: '/contests/' },
];

const Chevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
);

export default function Nav() {
  const path = usePathname() || '/';
  const [open, setOpen] = useState(null); // which drop-down is open
  const [mobile, setMobile] = useState(false); // phone panel
  const ref = useRef(null);
  const timer = useRef(0);
  const lastPointer = useRef('mouse');
  const active = (href) => path.startsWith(href);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(null); setMobile(false); } };
    const esc = (e) => { if (e.key === 'Escape') { setOpen(null); setMobile(false); } };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, []);
  useEffect(() => { setOpen(null); setMobile(false); }, [path]);

  const hover = (key) => (e) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(timer.current);
    if (key) setOpen(key);
    else timer.current = setTimeout(() => setOpen(null), 180);
  };

  return (
    <div className="nav-wrap" ref={ref}>
      <button type="button" className="icon-btn nav-burger" aria-expanded={mobile} aria-controls="main-nav" aria-label={mobile ? 'Close menu' : 'Open menu'} onClick={() => setMobile((m) => !m)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {mobile ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <nav id="main-nav" className={`nav${mobile ? ' open' : ''}`} aria-label="Main">
        {MENU.map((g) =>
          g.href ? (
            <a key={g.key} className="nav-top" href={g.href} aria-current={active(g.href) ? 'page' : undefined}>{g.label}</a>
          ) : (
            <div key={g.key} className="nav-group" onPointerEnter={hover(g.key)} onPointerLeave={hover(null)}>
              <button
                type="button"
                className="nav-top"
                aria-expanded={open === g.key}
                aria-controls={`menu-${g.key}`}
                data-active={g.links.some(([h]) => active(h)) || undefined}
                onPointerDown={(e) => { lastPointer.current = e.pointerType; }}
                // with a mouse, hovering already opened it, so a click keeps it open; touch and keyboard toggle
                onClick={() => setOpen((o) => (o === g.key && lastPointer.current !== 'mouse' ? null : g.key))}
              >
                {g.label} <Chevron />
              </button>
              <div id={`menu-${g.key}`} className={`nav-menu${open === g.key ? ' show' : ''}`}>
                {g.links.map(([href, label, note]) => (
                  <a key={href} href={href} aria-current={active(href) ? 'page' : undefined}>
                    <b>{label}</b>
                    <small>{note}</small>
                  </a>
                ))}
              </div>
            </div>
          ),
        )}
      </nav>
    </div>
  );
}
