// Shared body of every /top/ ranking page: a numbered list with poster, facts, a line about the show,
// where to watch, then how it's ranked, an FAQ, and links to the other rankings.
import AdSlot from '@/components/AdSlot';
import { formatLabel, airedLabel } from '@/lib/catalog';
import { hueFor } from '@/lib/site';
import { SITE, absUrl } from '@/lib/site';
import { JsonLd, breadcrumbs } from '@/lib/seo';
import { introFor, faqFor, rankingPages, monthName } from '@/lib/rankings';
import AdsScript from '@/components/AdsScript';

const firstSentence = (t) => {
  const m = String(t || '').match(/^(.{40,220}?[.!?])(\s|$)/);
  return m ? m[1] : '';
};

function RankRow({ s, rank, anticipated }) {
  const facts = [formatLabel(s.format), s.episodes ? `${s.episodes} episodes` : null, s.studios?.[0], anticipated ? airedLabel(s) : s.season_year ? `${s.season ? s.season[0] + s.season.slice(1).toLowerCase() + ' ' : ''}${s.season_year}` : null].filter(Boolean);
  const watch = (s.streaming || []).map((x) => x.site).filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 3);
  return (
    <li className="rank-row glass" id={`rank-${rank}`}>
      <span className="rank-n">{rank}</span>
      <a className="rank-poster" href={`/anime/${s.slug}/`} style={{ '--h': hueFor(s.title), '--c': s.cover_color || undefined }}>
        {s.cover_url ? <img src={s.cover_url} alt={`${s.title} poster`} loading={rank <= 3 ? 'eager' : 'lazy'} referrerPolicy="no-referrer" /> : <b>{s.title}</b>}
      </a>
      <div className="rank-body">
        <h2><a href={`/anime/${s.slug}/`}>{s.title}</a></h2>
        <p className="meta">{facts.join(' · ')}</p>
        {firstSentence(s.summary) && <p>{firstSentence(s.summary)}</p>}
        <p className="rank-stats">
          {anticipated ? (
            <span><b>{(s.popularity || 0).toLocaleString('en-US')}</b> fans waiting</span>
          ) : (
            <>
              {s.score ? <span><b>{s.score}%</b> fan score</span> : null}
              {s.popularity ? <span>{s.popularity.toLocaleString('en-US')} ratings and lists</span> : null}
            </>
          )}
          {s.genres?.slice(0, 3).map((g) => <span key={g} className="chip">{g}</span>)}
        </p>
        {!anticipated && <p className="meta">{watch.length ? <>Watch on {watch.join(', ')} · </> : null}<a href={`/anime/${s.slug}/#watch`}>Where to watch</a></p>}
      </div>
    </li>
  );
}

export async function RankingView({ p }) {
  const all = await rankingPages();
  const path = `/top/${p.id}/`;
  const anticipated = p.kind === 'anticipated';
  const faq = faqFor(p);
  const updated = new Date().toISOString().slice(0, 10);
  const jsonLd = [
    breadcrumbs([['Home', '/'], ['Top 10', '/top/'], [p.title, path]]),
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: p.title,
      numberOfItems: p.items.length,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      itemListElement: p.items.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.title, url: absUrl(`/anime/${s.slug}/`) })),
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ];
  const years = all.filter((x) => x.kind === 'year');
  const months = all.filter((x) => x.kind === 'month' && x.year === p.year);
  const others = all.filter((x) => x.kind === 'donghua' || x.kind === 'anticipated');
  return (
    <div className="wrap">
      <AdsScript />
      <JsonLd data={jsonLd} />
      <header className="page-head">
        <p className="eyebrow">Top 10 · updated {updated}</p>
        <h1>{p.h1}</h1>
        <p>{introFor(p)}</p>
      </header>
      <nav className="tabs" aria-label="Rankings">
        {years.map((y) => <a key={y.id} className="chip" href={`/top/${y.id}/`} aria-current={y.id === p.id ? 'page' : undefined}>{y.year}</a>)}
        {months.slice(0, 4).map((m) => <a key={m.id} className="chip" href={`/top/${m.id}/`} aria-current={m.id === p.id ? 'page' : undefined}>{monthName(m.month)}</a>)}
        {others.map((o) => <a key={o.id} className="chip" href={`/top/${o.id}/`} aria-current={o.id === p.id ? 'page' : undefined}>{o.kind === 'donghua' ? `Donghua ${o.year}` : `Coming in ${o.year}`}</a>)}
      </nav>
      <AdSlot slot="top" />
      <ol className="rank-list">
        {p.items.map((s, i) => <RankRow key={s.id} s={s} rank={i + 1} anticipated={anticipated} />)}
      </ol>
      {p.extra?.filter((e) => e.items.length >= 3).map((e) => (
        <section key={e.title} className="section">
          <div className="section-head"><h2>{e.title}</h2></div>
          <ol className="rank-list">{e.items.map((s, i) => <RankRow key={s.id} s={s} rank={i + 1} />)}</ol>
        </section>
      ))}
      <AdSlot slot="bottom" />
      <section className="section glass panel">
        <h2>Frequently asked questions</h2>
        {faq.map((f) => (
          <div key={f.q} className="faq-item">
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </section>
      <section className="section">
        <div className="section-head"><h2>More rankings</h2></div>
        <div className="tabs">
          {all.filter((x) => x.id !== p.id).slice(0, 18).map((x) => <a key={x.id} className="chip" href={`/top/${x.id}/`}>{x.title.replace(/:.*$/, '')}</a>)}
        </div>
      </section>
      <p className="meta credit-line">Scores and fan counts from <a href="https://anilist.co" target="_blank" rel="noopener">AniList</a>, refreshed daily. {SITE.name} ranks only; we don't host or stream any anime.</p>
    </div>
  );
}
