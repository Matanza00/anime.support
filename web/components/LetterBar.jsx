import { LETTERS } from '@/lib/catalog';

export default function LetterBar({ current }) {
  return (
    <nav className="letters" aria-label="Browse A to Z">
      {LETTERS.map((l) => (
        <a key={l} href={`/anime/browse/${l}/`} aria-current={l === current ? 'page' : undefined}>{l === '0-9' ? '#' : l.toUpperCase()}</a>
      ))}
    </nav>
  );
}
