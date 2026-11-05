import { notFound } from 'next/navigation';
import { allShows, LETTERS, letterOf } from '@/lib/catalog';
import { ShowGrid } from '@/components/ShowCard';
import LetterBar from '@/components/LetterBar';
import { JsonLd, breadcrumbs } from '@/lib/seo';

export const dynamicParams = false;
export const generateStaticParams = () => LETTERS.map((letter) => ({ letter }));
const name = (l) => (l === '0-9' ? 'numbers and symbols' : `the letter ${l.toUpperCase()}`);

export async function generateMetadata({ params }) {
  const { letter } = await params;
  return {
    title: `Anime starting with ${letter === '0-9' ? 'a number' : letter.toUpperCase()}`,
    description: `Every anime and donghua in our database whose title starts with ${name(letter)}, with where to watch each one.`,
    alternates: { canonical: `/anime/browse/${letter}/` },
  };
}

export default async function Browse({ params }) {
  const { letter } = await params;
  if (!LETTERS.includes(letter)) notFound();
  const shows = (await allShows()).filter((s) => letterOf(s.title) === letter).sort((a, b) => a.title.localeCompare(b.title, 'en'));
  return (
    <div className="wrap">
      <JsonLd data={breadcrumbs([['Home', '/'], ['Anime', '/anime/'], [letter.toUpperCase(), `/anime/browse/${letter}/`]])} />
      <header className="page-head">
        <p className="eyebrow">Anime A–Z</p>
        <h1>Anime starting with {letter === '0-9' ? '#' : letter.toUpperCase()}</h1>
        <p>{shows.length} title{shows.length === 1 ? '' : 's'}, A to Z.</p>
      </header>
      <LetterBar current={letter} />
      <section className="section">
        {shows.length ? <ShowGrid shows={shows} /> : <div className="glass empty">No titles under {name(letter)} yet.</div>}
      </section>
    </div>
  );
}
