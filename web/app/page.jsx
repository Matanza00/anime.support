import Card, { Pill, RowCard } from '@/components/Card';
import Cover, { coverAlt } from '@/components/Cover';
import AdSlot from '@/components/AdSlot';
import { MostRead, TrendingChart, ComingSoon } from '@/components/Widgets';
import { allArticles, animeHubs } from '@/lib/db';
import { ShowGrid } from '@/components/ShowCard';
import Schedule from '@/components/Schedule';
import { scheduleData, showsInSeason, seasonOf, seasonId, seasonLabel } from '@/lib/catalog';
import { CATEGORIES, SITE, articlePath, catLabel, formatDate } from '@/lib/site';
import { JsonLd, publisher, ogBase } from '@/lib/seo';

const HOME_DESCRIPTION = 'anime.support is an independent anime news site: confirmed announcements, release dates, airing schedules, seasonal charts and where to watch every show legally.';

export const metadata = {
  description: HOME_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: { ...ogBase, type: 'website', url: '/', title: `${SITE.name}: ${SITE.tagline}`, description: HOME_DESCRIPTION, images: [{ url: '/brand/logo.png', width: 1200, height: 488, alt: SITE.name }] },
  twitter: { card: 'summary_large_image', title: `${SITE.name}: ${SITE.tagline}`, description: HOME_DESCRIPTION },
};

export default async function Home() {
  const all = await allArticles();
  const [lead, ...rest] = all;
  const secondary = rest.slice(0, 3);
  const latest = rest.slice(3, 15);
  const hubs = (await animeHubs()).slice(0, 16);
  const byCat = (c) => all.filter((a) => a.category === c).slice(0, 3);
  const cur = seasonOf();
  const seasonTop = (await showsInSeason(cur)).filter((x) => x.country !== 'CN').slice(0, 12);
  const slots = (await scheduleData()).filter((x) => x.t > Date.now() / 1000 - 86400 && x.t < Date.now() / 1000 + 2 * 86400);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${SITE.url}/#website`, name: SITE.name, alternateName: ['Anime Support', 'animesupport', 'anime support news'], url: `${SITE.url}/`, description: HOME_DESCRIPTION, inLanguage: 'en', publisher: { '@id': `${SITE.url}/#org` }, potentialAction: { '@type': 'SearchAction', target: `${SITE.url}/search/?q={query}`, 'query-input': 'required name=query' } },
      { ...publisher, '@id': `${SITE.url}/#org` },
    ],
  };

  if (!lead) {
    return (
      <div className="wrap section">
        <JsonLd data={jsonLd} />
        <div className="glass empty">
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>{SITE.name}: the newsroom is warming up</h1>
          <p>The first stories appear here as soon as they are approved.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <JsonLd data={jsonLd} />
      <h1 className="home-brand">
        <span className="name">{SITE.name}</span>
        <span className="sr-only">: </span>
        <span className="tag">{SITE.tagline}</span>
      </h1>

      {/* Featured story + top stories, the layout every major anime outlet leads with */}
      <section className="hero" aria-label="Top stories">
        <a className="lead glass" href={articlePath(lead.slug)}>
          <Cover label={lead.anime?.[0] ?? catLabel(lead.category)} alt={coverAlt(lead)} image={lead.cover_url} credit={lead.cover_credit} eager />
          <div className="body">
            <div><Pill category={lead.category} /></div>
            <h2 style={{ fontSize: 'clamp(26px, 3.4vw, 42px)' }}>{lead.title}</h2>
            <p>{lead.excerpt}</p>
            <div className="meta"><time dateTime={lead.published_at}>{formatDate(lead.published_at)}</time>{lead.anime?.[0] && <span>{lead.anime[0]}</span>}</div>
          </div>
        </a>
        <div className="stack">
          {secondary.map((a) => <RowCard key={a.id} article={a} />)}
          <MostRead limit={4} title="Most read" />
        </div>
      </section>

      <AdSlot slot="top" />

      <ComingSoon limit={4} />

      {seasonTop.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>{seasonLabel(cur.season)} {cur.year}: most popular this season</h2>
            <a href={`/season/${seasonId(cur)}/`}>Full season chart →</a>
          </div>
          <ShowGrid shows={seasonTop} ranked />
        </section>
      )}

      <div className="two-col section">
        <div>
          <div className="section-head">
            <h2>Latest news</h2>
            <a href="/news/">All news →</a>
          </div>
          <div className="grid">{latest.map((a) => <Card key={a.id} article={a} />)}</div>
          <div className="pager"><a className="btn ghost" href="/news/">More stories</a></div>

          {['upcoming', 'release', 'feature'].map((c) =>
            byCat(c).length ? (
              <section key={c} className="section">
                <div className="section-head">
                  <h2>{CATEGORIES[c].label}</h2>
                  <a href={CATEGORIES[c].path}>See all →</a>
                </div>
                <div className="grid">{byCat(c).map((a) => <Card key={a.id} article={a} />)}</div>
              </section>
            ) : null,
          )}
        </div>

        <aside className="sidebar" aria-label="Trending">
          {slots.length > 0 && (
            <section className="panel glass airing-today" aria-labelledby="airing-today">
              <h2 id="airing-today">Airing next</h2>
              <Schedule slots={slots} builtAt={Math.floor(Date.now() / 1000)} compact limitDays={2} maxItems={6} />
              <a className="btn ghost" href="/schedule/" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>Full schedule</a>
            </section>
          )}
          <TrendingChart limit={10} />
          {hubs.length > 0 && (
            <section className="panel glass" aria-labelledby="follow">
              <h2 id="follow">Follow your anime</h2>
              <div className="tabs" style={{ marginBottom: 0 }}>
                {hubs.map((h) => <a key={h.slug} className="chip" href={`/anime/${h.slug}/`}>{h.name}</a>)}
              </div>
            </section>
          )}
          <AdSlot slot="bottom" />
        </aside>
      </div>
    </div>
  );
}
