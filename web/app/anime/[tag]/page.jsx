// One page per anime: catalog facts (AniList), where to watch it legally, the next episode, our own
// overview and every news story we wrote about it. News-only hubs (no catalog match) still work.
import { notFound } from 'next/navigation';
import Card from '@/components/Card';
import Cover from '@/components/Cover';
import AdSlot from '@/components/AdSlot';
import ShowCard from '@/components/ShowCard';
import NextEpisode from '@/components/NextEpisode';
import Trailer from '@/components/Trailer';
import { ReleaseCard, TrendingChart } from '@/components/Widgets';
import { animePages, indexable, franchise, similar, factLine, formatLabel, statusLabel, sourceLabel, countryLabel, airedLabel, seasonLabel, seasonId, seasonWindow } from '@/lib/catalog';
import { absUrl, formatDate } from '@/lib/site';
import { JsonLd, breadcrumbs } from '@/lib/seo';

export const dynamicParams = false;

async function page(tag) {
  return (await animePages()).get(tag) ?? null;
}

export async function generateStaticParams() {
  const list = [...(await animePages()).keys()].map((tag) => ({ tag }));
  return list.length ? list : [{ tag: '__none' }];
}

export async function generateMetadata({ params }) {
  const p = await page((await params).tag);
  if (!p) return { title: 'Not found', robots: { index: false } };
  const robots = p.alias || indexable(p) ? undefined : { index: false, follow: true };
  const canonical = `/anime/${p.canonical}/`;
  if (!p.show) {
    const h = p.hub;
    const title = `${h.name}: news, release date and everything confirmed`;
    return {
      title,
      description: `Everything officially confirmed about ${h.name}: new seasons, release dates, cast and story news. Updated ${formatDate(h.latest)}.`,
      alternates: { canonical },
      openGraph: { title, images: h.cover ? [absUrl(h.cover)] : undefined },
    };
  }
  const s = p.show;
  const what = s.format === 'MOVIE' ? 'release date, trailer and where to watch' : s.status === 'RELEASING' ? 'episode schedule, where to watch and news' : s.status === 'NOT_YET_RELEASED' ? 'release date, trailer and news' : 'where to watch, episodes and news';
  const title = `${s.title}: ${what}`;
  const description = `${factLine(s)}`.slice(0, 158);
  return {
    title,
    description,
    alternates: { canonical },
    robots,
    openGraph: { title, description, images: s.banner_url || s.cover_url ? [s.banner_url || s.cover_url] : undefined },
  };
}

export default async function AnimePage({ params }) {
  const p = await page((await params).tag);
  if (!p) notFound();
  return p.show ? <ShowPage p={p} /> : <HubPage h={p.hub} />;
}

/* ---------------- catalog show ---------------- */

async function ShowPage({ p }) {
  const s = p.show;
  const news = p.hub?.articles ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const dated = news.filter((a) => a.release_date && a.release_date >= today).sort((a, b) => a.release_date.localeCompare(b.release_date));
  const [fam, alike] = await Promise.all([franchise(s), similar(s)]);
  const inWindow = seasonWindow().some((w) => w.season === s.season && w.year === s.season_year);
  const url = `/anime/${p.canonical}/`;

  const facts = [
    ['Format', formatLabel(s.format)],
    ['Status', statusLabel(s.status)],
    ['Episodes', s.format === 'MOVIE' ? null : s.episodes ? String(s.episodes) : s.status === 'RELEASING' ? 'Ongoing' : null],
    ['Length', s.duration ? (s.format === 'MOVIE' ? `${s.duration} min` : `${s.duration} min per episode`) : null],
    [s.format === 'MOVIE' ? 'Released' : 'Aired', airedLabel(s)],
    ['Season', s.season && s.season_year ? inWindow ? <a href={`/season/${seasonId({ season: s.season, year: s.season_year })}/`}>{seasonLabel(s.season)} {s.season_year}</a> : `${seasonLabel(s.season)} ${s.season_year}` : null],
    ['Studio', s.studios?.join(', ')],
    ['Based on', sourceLabel(s.source) ? sourceLabel(s.source)[0].toUpperCase() + sourceLabel(s.source).slice(1) : null],
    ['Country', countryLabel(s.country)],
    ['Japanese title', s.country === 'JP' ? s.title_native : null],
    ['Native title', s.country !== 'JP' ? s.title_native : null],
    ['Romaji', s.title_romaji && s.title_romaji !== s.title ? s.title_romaji : null],
    ['Also known as', s.synonyms?.length ? s.synonyms.slice(0, 4).join(' · ') : null],
  ].filter(([, v]) => v);

  const type = s.format === 'MOVIE' ? 'Movie' : 'TVSeries';
  const ld = {
    '@context': 'https://schema.org',
    '@type': type,
    name: s.title,
    alternateName: [s.title_romaji, s.title_native, ...(s.synonyms ?? [])].filter((x) => x && x !== s.title).slice(0, 6),
    url: absUrl(url),
    image: s.cover_url || undefined,
    genre: s.genres,
    description: s.summary || factLine(s),
    startDate: s.start_date || undefined,
    endDate: s.end_date || undefined,
    numberOfEpisodes: type === 'TVSeries' && s.episodes ? s.episodes : undefined,
    productionCompany: s.studios?.map((n) => ({ '@type': 'Organization', name: n })),
    countryOfOrigin: s.country ? { '@type': 'Country', name: countryLabel(s.country) } : undefined,
    trailer: s.trailer_youtube ? { '@type': 'VideoObject', name: `${s.title} trailer`, embedUrl: `https://www.youtube.com/embed/${s.trailer_youtube}`, thumbnailUrl: `https://i.ytimg.com/vi/${s.trailer_youtube}/hqdefault.jpg`, uploadDate: s.start_date || undefined } : undefined,
    sameAs: [s.official_site, s.anilist_url].filter(Boolean),
  };

  return (
    <div className="show-page">
      <JsonLd data={[breadcrumbs([['Home', '/'], ['Anime', '/anime/'], [s.title, url]]), ld]} />
      <div className="show-banner" style={{ '--c': s.cover_color || '#e4435a' }}>
        {s.banner_url && <img src={s.banner_url} alt="" referrerPolicy="no-referrer" fetchPriority="high" />}
      </div>
      <div className="wrap">
        <nav aria-label="Breadcrumb"><ol className="crumbs"><li><a href="/">Home</a></li><li><a href="/anime/">Anime</a></li>{s.country === 'CN' && <li><a href="/donghua/">Donghua</a></li>}</ol></nav>
        <header className="show-head glass">
          <div className="poster" style={{ '--c': s.cover_color || undefined }}>
            {s.cover_url ? <img src={s.cover_url} alt={`${s.title} key visual`} referrerPolicy="no-referrer" fetchPriority="high" /> : <b>{s.title}</b>}
          </div>
          <div className="show-title">
            <p className="eyebrow">{[formatLabel(s.format), s.country === 'CN' ? 'Donghua' : null, statusLabel(s.status)].filter(Boolean).join(' · ')}</p>
            <h1>{s.title}</h1>
            {s.title_native && <p className="native" lang={s.country === 'CN' ? 'zh' : s.country === 'KR' ? 'ko' : 'ja'}>{s.title_native}</p>}
            <div className="tabs" style={{ margin: '14px 0 0' }}>
              {s.genres?.map((g) => <span key={g} className="chip">{g}</span>)}
            </div>
            <div className="show-stats">
              {s.score ? <div><b>{s.score}%</b><small>AniList score</small></div> : null}
              {s.episodes && s.format !== 'MOVIE' ? <div><b>{s.episodes}</b><small>episodes</small></div> : null}
              {s.studios?.[0] && <div><b>{s.studios[0]}</b><small>studio</small></div>}
            </div>
            {s.status === 'RELEASING' && s.next_airing_at && <p className="next-line"><NextEpisode at={s.next_airing_at} ep={s.next_episode} /></p>}
            {s.status === 'NOT_YET_RELEASED' && <p className="next-line">{s.start_date ? `Premieres ${airedLabel({ ...s, format: 'MOVIE' })}` : 'Premiere date not announced yet'}</p>}
          </div>
        </header>

        <div className="two-col section">
          <div className="show-main">
            <section className="glass watch" aria-labelledby="watch">
              <h2 id="watch">Where to watch {s.title}</h2>
              {s.streaming?.length ? (
                <>
                  <div className="watch-links">
                    {s.streaming.map((l) => (
                      <a key={l.url} className="btn ghost" href={l.url} target="_blank" rel="noopener nofollow">
                        {l.site}{l.language ? <small> · {l.language}</small> : null}
                      </a>
                    ))}
                  </div>
                  <p className="meta">Official, licensed services only. What you can watch depends on your country; check the service for your region.</p>
                </>
              ) : (
                <p className="muted">{s.status === 'NOT_YET_RELEASED' ? 'Streaming services have not been announced yet. We add them here as soon as they are confirmed.' : 'No official streaming service is listed for this title yet. Check your local services, or the official site below.'}</p>
              )}
              {s.official_site && <p className="meta" style={{ marginTop: 8 }}><a href={s.official_site} target="_blank" rel="noopener nofollow">Official website ↗</a></p>}
            </section>

            <section className="section" aria-labelledby="about">
              <h2 id="about" className="h2">About {s.title}</h2>
              <div className="prose">
                {(s.summary || factLine(s)).split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
              </div>
            </section>

            {s.trailer_youtube && (
              <section className="section" aria-labelledby="trailer">
                <h2 id="trailer" className="h2">Trailer</h2>
                <Trailer id={s.trailer_youtube} title={s.title} />
              </section>
            )}

            <AdSlot slot="inArticle" />

            <section className="section" aria-labelledby="facts">
              <h2 id="facts" className="h2">Details</h2>
              <dl className="facts glass">
                {facts.map(([k, v]) => (
                  <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
              {s.tags?.length > 0 && <div className="tabs" style={{ marginTop: 14 }}>{s.tags.map((t) => <span key={t} className="chip quiet">{t}</span>)}</div>}
            </section>

            {dated.length > 0 && (
              <section className="section">
                <div className="section-head"><h2>Coming up</h2></div>
                <div className="releases">{dated.map((a) => <ReleaseCard key={a.id} article={a} />)}</div>
              </section>
            )}

            {news.length > 0 && (
              <section className="section">
                <div className="section-head"><h2>{s.title} news</h2></div>
                <div className="grid">{news.map((a) => <Card key={a.id} article={a} />)}</div>
              </section>
            )}

            {fam.length > 0 && (
              <section className="section">
                <div className="section-head"><h2>Seasons, films and spin-offs</h2></div>
                <div className="show-grid">{fam.map((x) => <ShowCard key={x.id} show={x} detail={<span>{statusLabel(x.status)}</span>} />)}</div>
              </section>
            )}

            {alike.length > 0 && (
              <section className="section">
                <div className="section-head"><h2>If you like {s.title}</h2></div>
                <div className="show-grid">{alike.map((x) => <ShowCard key={x.id} show={x} />)}</div>
              </section>
            )}

            <p className="meta credit-line">
              Show details and artwork from <a href={s.anilist_url || 'https://anilist.co'} target="_blank" rel="noopener">AniList</a>; artwork © its rights holders.{s.summary ? ' Overview written by anime.support.' : ''}
              {s.updated_at && <> Updated {formatDate(s.updated_at)}.</>}
            </p>
          </div>
          <aside className="sidebar">
            <TrendingChart limit={8} />
            <AdSlot slot="bottom" />
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ---------------- news-only hub ---------------- */

function HubPage({ h }) {
  const today = new Date().toISOString().slice(0, 10);
  const dated = h.articles.filter((a) => a.release_date && a.release_date >= today).sort((a, b) => a.release_date.localeCompare(b.release_date));
  return (
    <div className="wrap section">
      <JsonLd
        data={[
          breadcrumbs([['Home', '/'], ['Anime', '/anime/'], [h.name, `/anime/${h.slug}/`]]),
          { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${h.name} news`, url: absUrl(`/anime/${h.slug}/`) },
        ]}
      />
      <nav aria-label="Breadcrumb"><ol className="crumbs"><li><a href="/">Home</a></li><li><a href="/anime/">Anime</a></li></ol></nav>
      <header className="glass" style={{ overflow: 'hidden' }}>
        <Cover label={h.name} image={h.cover} eager className="hub-cover" />
        <div className="article-head" style={{ background: 'none', border: 0 }}>
          <p className="eyebrow">Everything confirmed so far</p>
          <h1>{h.name}</h1>
          <p className="meta">{h.count} {h.count === 1 ? 'story' : 'stories'} · updated {formatDate(h.latest)}</p>
        </div>
      </header>
      <AdSlot slot="top" />
      <div className="two-col section">
        <div>
          {dated.length > 0 && (
            <section className="section" style={{ paddingTop: 0 }}>
              <div className="section-head"><h2>Coming up</h2></div>
              <div className="releases">{dated.map((a) => <ReleaseCard key={a.id} article={a} />)}</div>
            </section>
          )}
          <div className="section-head"><h2>All {h.name} news</h2></div>
          <div className="grid">{h.articles.map((a) => <Card key={a.id} article={a} />)}</div>
        </div>
        <aside className="sidebar"><TrendingChart limit={8} /></aside>
      </div>
    </div>
  );
}
