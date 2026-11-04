'use client';
import { usePathname } from 'next/navigation';

const LINKS = [
  ['/', 'Latest'],
  ['/news/', 'News'],
  ['/upcoming/', 'Upcoming'],
  ['/releases/', 'Out now'],
  ['/calendar/', 'Calendar'],
  ['/features/', 'Features'],
  ['/anime/', 'Anime A–Z'],
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
