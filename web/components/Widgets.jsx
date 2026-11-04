// Sidebar / home widgets, all rendered at build time.
import { mostRead, trendingAnime, upcomingReleases } from '@/lib/db';
import { articlePath, formatDate } from '@/lib/site';
import Countdown from './Countdown';

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
  const list = await trendingAnime(limit);
  if (!list.length) return null;
  return (
    <section className="panel glass" aria-labelledby="trending-anime">
      <h2 id="trending-anime">Trending anime this week</h2>
      <ol className="chart">
        {list.map((t, i) => (
          <li key={t.slug}>
            <a href={t.hub ? `/anime/${t.slug}/` : `/search/?q=${encodeURIComponent(t.name)}`}>
              <span className="n">{i + 1}</span>
              <span className="name">{t.name}</span>
              <span className="count">{t.hub ? `${t.hub.count} ${t.hub.count === 1 ? 'story' : 'stories'}` : ''}</span>
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
  if (!list.length) return null;
  return (
    <section className="section">
      <div className="section-head">
        <h2>Coming soon</h2>
        <a href="/calendar/">Full release calendar →</a>
      </div>
      <div className="releases">{list.map((a) => <ReleaseCard key={a.id} article={a} />)}</div>
    </section>
  );
}
