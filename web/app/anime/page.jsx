import { animeHubs } from '@/lib/db';
import LetterBar from '@/components/LetterBar';
import { allShows, animePages, seasonOf, seasonId, seasonLabel } from '@/lib/catalog';
import Cover from '@/components/Cover';
import AdSlot from '@/components/AdSlot';
import { ShowGrid } from '@/components/ShowCard';
import { JsonLd, breadcrumbs } from '@/lib/seo';

export const metadata = {
  title: 'Anime database: every show, where to watch and what is airing',
  description: 'Browse anime and donghua: what is airing now, what is coming next, where to watch each show legally, episode schedules and every confirmed piece of news.',
  alternates: { canonical: '/anime/' },
};

export default async function AnimeIndex() {
  const shows = await allShows();
  const airing = shows.filter((s) => s.status === 'RELEASING' && s.country !== 'CN').slice(0, 18);
  const soon = shows.filter((s) => s.status === 'NOT_YET_RELEASED').slice(0, 12);
  const classics = shows.filter((s) => s.status === 'FINISHED').slice(0, 12);
  const pages = await animePages();
  const covered = (await animeHubs()).filter((h) => !pages.get(h.slug)?.show).sort((a, b) => a.name.localeCompare(b.name));
  const cur = seasonOf();
  return (
    <div className="wrap">
      <JsonLd data={breadcrumbs([['Home', '/'], ['Anime', '/anime/']])} />
      <header className="page-head">
        <p className="eyebrow">Database</p>
        <h1>Anime database</h1>
        <p>{shows.length ? `${shows.length.toLocaleString('en-US')} shows and films` : 'Every show we cover'}, each with where to watch it legally, the next episode and all of our news.</p>
      </header>
      <LetterBar />
      <div className="tabs section" style={{ paddingBottom: 0 }}>
        <a className="chip" href="/schedule/">Airing schedule</a>
        <a className="chip" href={`/season/${seasonId(cur)}/`}>{seasonLabel(cur.season)} {cur.year} season</a>
        <a className="chip" href="/donghua/">Donghua (Chinese anime)</a>
        <a className="chip" href="/search/">Search</a>
      </div>
      <AdSlot slot="top" />
      {airing.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Most popular airing now</h2><a href="/schedule/">Schedule →</a></div>
          <ShowGrid shows={airing} ranked eager={6} />
        </section>
      )}
      {soon.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Most anticipated</h2><a href={`/season/${seasonId(cur)}/`}>This season →</a></div>
          <ShowGrid shows={soon} />
        </section>
      )}
      {classics.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>All-time favourites</h2></div>
          <ShowGrid shows={classics} />
        </section>
      )}
      {covered.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>More from our newsroom</h2></div>
          <div className="grid">
            {covered.map((h) => (
              <a key={h.slug} className="card glass" href={`/anime/${h.slug}/`}>
                <Cover label={h.name} image={h.cover} />
                <div className="body"><h3>{h.name}</h3><div className="meta">{h.count} {h.count === 1 ? 'story' : 'stories'}</div></div>
              </a>
            ))}
          </div>
        </section>
      )}
      {!shows.length && !covered.length && <div className="glass empty section">The anime database fills in after the first daily catalog update.</div>}
    </div>
  );
}
