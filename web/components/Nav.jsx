'use client';
import { usePathname } from 'next/navigation';

const LINKS = [
  ['/', 'Latest'],
  ['/news/', 'News'],
  ['/schedule/', 'Schedule'],
  ['/season/', 'Seasons'],
  ['/anime/', 'Anime'],
  ['/donghua/', 'Donghua'],
  ['/contests/', 'Contests'],
  ['/upcoming/', 'Upcoming'],
  ['/calendar/', 'Calendar'],
  ['/features/', 'Features'],
];

export default function Nav() {
  const path = usePathname() || '/';
  const active = (href) => (href === '/' ? path === '/' : path.startsWith(href));
  return (
    <nav className="nav" aria-label="Main">
      {LINKS.map(([href, label]) => (
        <a key={href} href={href} aria-current={active(href) ? 'page' : undefined}>{label}</a>
      ))}
    </nav>
  );
}
