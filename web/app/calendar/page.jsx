import { ReleaseCard } from '@/components/Widgets';
import AdSlot from '@/components/AdSlot';
import { upcomingReleases } from '@/lib/db';
import { formatDate } from '@/lib/site';
import { JsonLd, breadcrumbs } from '@/lib/seo';

export const metadata = {
  title: 'Anime release calendar',
  description: 'Officially confirmed premiere and release dates for upcoming anime seasons, films and episodes, with a countdown for each.',
  alternates: { canonical: '/calendar/' },
};

export default async function Calendar() {
  const list = await upcomingReleases();
  const months = new Map();
  for (const a of list) {
    const key = a.release_date.slice(0, 7);
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(a);
  }
  return (
    <div className="wrap">
      <JsonLd data={breadcrumbs([['Home', '/'], ['Release calendar', '/calendar/']])} />
      <header className="page-head">
        <p className="eyebrow">Countdown</p>
        <h1>Anime release calendar</h1>
        <p>Only dates that studios, publishers or streaming services have officially confirmed. Each card links to the story with the details.</p>
      </header>
      <AdSlot slot="top" />
      {months.size === 0 && <div className="glass empty section">No confirmed dates right now. New dates appear here as soon as they are announced.</div>}
      {[...months].map(([key, items]) => (
        <section key={key} className="month">
          <h2>{formatDate(`${key}-01`, { month: 'long', year: 'numeric' })}</h2>
          <div className="releases">{items.map((a) => <ReleaseCard key={a.id} article={a} />)}</div>
        </section>
      ))}
    </div>
  );
}
