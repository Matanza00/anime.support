import Card, { Pill, RowCard } from '@/components/Card';
import Cover from '@/components/Cover';
import AdSlot from '@/components/AdSlot';
import { MostRead, TrendingChart, ComingSoon } from '@/components/Widgets';
import { allArticles, animeHubs } from '@/lib/db';
import { CATEGORIES, SITE, articlePath, catLabel, formatDate } from '@/lib/site';
import { JsonLd, publisher } from '@/lib/seo';

export default async function Home() {
  const all = await allArticles();
  const [lead, ...rest] = all;
  const secondary = rest.slice(0, 3);
  const latest = rest.slice(3, 15);
  const hubs = (await animeHubs()).slice(0, 16);
  const byCat = (c) => all.filter((a) => a.category === c).slice(0, 3);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: SITE.name, url: SITE.url, potentialAction: { '@type': 'SearchAction', target: `${SITE.url}/search/?q={query}`, 'query-input': 'required name=query' } },
      { ...publisher, '@id': `${SITE.url}/#org` },
    ],
  };

  if (!lead) {
    return (
      <div className="wrap section">
        <JsonLd data={jsonLd} />
        <div className="glass empty">
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>The newsroom is warming up</h1>
          <p>The first stories appear here as soon as they are approved.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <JsonLd data={jsonLd} />
      <h1 className="sr-only">{SITE.name}: {SITE.tagline}</h1>

      {/* Featured story + top stories, the layout every major anime outlet leads with */}
      <section className="hero" aria-label="Top stories">
        <a className="lead glass" href={articlePath(lead.slug)}>
          <Cover label={lead.anime?.[0] ?? catLabel(lead.category)} image={lead.cover_url} credit={lead.cover_credit} eager />
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
