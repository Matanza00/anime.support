import { animeHubs } from '@/lib/db';
import Cover from '@/components/Cover';
import { JsonLd, breadcrumbs } from '@/lib/seo';

export const metadata = {
  title: 'Anime A–Z',
  description: 'Every anime we cover, each with all of its confirmed news, seasons and release dates on one page.',
  alternates: { canonical: '/anime/' },
};

export default async function AnimeIndex() {
  const hubs = [...(await animeHubs())].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="wrap">
      <JsonLd data={breadcrumbs([['Home', '/'], ['Anime A–Z', '/anime/']])} />
      <header className="page-head">
        <p className="eyebrow">Shows</p>
        <h1>Anime A–Z</h1>
        <p>One page per series with everything confirmed so far.</p>
      </header>
      {hubs.length ? (
        <div className="grid section">
          {hubs.map((h) => (
            <a key={h.slug} className="card glass" href={`/anime/${h.slug}/`}>
              <Cover label={h.name} image={h.cover} />
              <div className="body">
                <h3>{h.name}</h3>
                <div className="meta">{h.count} {h.count === 1 ? 'story' : 'stories'}</div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="glass empty section">No series covered yet.</div>
      )}
    </div>
  );
}
