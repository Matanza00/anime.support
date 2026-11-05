// Sidebar / home widgets, all rendered at build time.
import { mostRead, trendingAnime, upcomingReleases } from '@/lib/db';
import { articlePath, formatDate } from '@/lib/site';
import Countdown from './Countdown';
import { allShows, showForName, premieres } from '@/lib/catalog';
import PremiereCard from './PremiereCard';

export async function MostRead({ title = 'Most read this week', limit = 5 }) {
  const list = await mostRead(limit);
  if (!list.length) return null;
  return (
    <section className="panel glass" aria-labelledby="most-read">
      <h2 id="most-read">{title}</h2>
      <ol className="ranked">
        {list.map((a, i) => (
          <li key={a.id}>
            <a href={articlePath(a.slug)}>
              <span className="n">{i + 1}</span>
              <div>
                <h3>{a.title}</h3>
                <div className="meta" style={{ marginTop: 4 }}>{formatDate(a.published_at)}</div>
              </div>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

export async function TrendingChart({ limit = 10 }) {
  let list = await Promise.all(
    (await trendingAnime(limit)).map(async (t) => {
      const show = await showForName(t.name);
      const href = show ? `/anime/${show.slug}/` : t.hub ? `/anime/${t.slug}/` : `/search/?q=${encodeURIComponent(t.name)}`;
      return { key: t.slug, name: t.name, href, note: t.hub ? `${t.hub.count} ${t.hub.count === 1 ? 'story' : 'stories'}` : show?.status === 'RELEASING' ? 'airing' : '' };
    }),
  );
  if (list.length < 5) {
    // no reader data yet: AniList's trending list
    const shows = [...(await allShows())].sort((a, b) => (b.trending || 0) - (a.trending || 0)).slice(0, limit);
    if (shows.length >= 5) list = shows.map((s) => ({ key: s.slug, name: s.title, href: `/anime/${s.slug}/`, note: s.status === 'RELEASING' ? 'airing' : '' }));
  }
  if (!list.length) return null;
  return (
    <section className="panel glass" aria-labelledby="trending-anime">
      <h2 id="trending-anime">Trending anime this week</h2>
      <ol className="chart">
        {list.map((t, i) => (
          <li key={t.key}>
            <a href={t.href}>
              <span className="n">{i + 1}</span>
              <span className="name">{t.name}</span>
              <span className="count">{t.note}</span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ReleaseCard({ article: a }) {
  return (
    <a className="rel-card glass" href={articlePath(a.slug)}>
      <span className="date">{formatDate(a.release_date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
      <Countdown date={a.release_date} />
      <h3>{a.anime?.[0] || a.title}</h3>
      <span className="meta">{a.title}</span>
    </a>
  );
}

export async function ComingSoon({ limit = 4 }) {
  const list = await upcomingReleases(limit);
  // fill with premieres from the anime database (popular ones first among the next 45 days)
  const horizon = new Date(Date.now() + 45 * 864e5).toISOString().slice(0, 10);
  const shows = (await premieres()).dated.filter((s) => s.start_date <= horizon).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, Math.max(0, limit - list.length)).sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (!list.length && !shows.length) return null;
  return (
    <section className="section">
      <div className="section-head">
        <h2>Coming soon</h2>
        <a href="/calendar/">Full release calendar →</a>
      </div>
      {list.length > 0 && <div className="releases" style={{ marginBottom: shows.length ? 14 : 0 }}>{list.map((a) => <ReleaseCard key={a.id} article={a} />)}</div>}
      {shows.length > 0 && <div className="prem-grid">{shows.map((s) => <PremiereCard key={s.id} show={s} />)}</div>}
    </section>
  );
}
