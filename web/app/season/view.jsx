// Shared body of /season/ and /season/<id>/: a season's shows grouped by format.
import { ShowGrid } from '@/components/ShowCard';
import AdSlot from '@/components/AdSlot';
import { showsInSeason, allShows, seasonWindow, seasonId, seasonLabel } from '@/lib/catalog';
import { JsonLd, breadcrumbs } from '@/lib/seo';

export async function SeasonView({ s, isIndex = false }) {
  const list = await showsInSeason(s);
  const win = seasonWindow();
  const cur = win[1];
  const isCurrent = s.season === cur.season && s.year === cur.year;
  const groups = [
    ['TV series', list.filter((x) => ['TV', 'TV_SHORT'].includes(x.format) && x.country !== 'CN')],
    ['Films', list.filter((x) => x.format === 'MOVIE')],
    ['Web series, OVAs and specials', list.filter((x) => ['ONA', 'OVA', 'SPECIAL'].includes(x.format) && x.country !== 'CN')],
    ['Donghua (Chinese anime)', list.filter((x) => x.country === 'CN' && x.format !== 'MOVIE')],
  ];
  const ids = new Set(list.map((x) => x.id));
  const continuing = isCurrent ? (await allShows()).filter((x) => x.status === 'RELEASING' && !ids.has(x.id) && x.country !== 'CN').slice(0, 24) : [];
  const name = `${seasonLabel(s.season)} ${s.year}`;
  const path = `/season/${seasonId(s)}/`;
  return (
    <div className="wrap">
      <JsonLd data={breadcrumbs([['Home', '/'], ['Seasons', '/season/'], ...(isIndex ? [] : [[name, path]])])} />
      <header className="page-head">
        <p className="eyebrow">Seasonal chart</p>
        <h1>{name} anime{isIndex ? ' season' : ''}</h1>
        <p>{list.length} new show{list.length === 1 ? '' : 's'} and films premiering in {name}, most popular first, with where to watch each one.</p>
      </header>
      <nav className="tabs" aria-label="Seasons">
        {win.map((w) => (
          <a key={seasonId(w)} className="chip" href={`/season/${seasonId(w)}/`} aria-current={w.season === s.season && w.year === s.year ? 'page' : undefined}>
            {seasonLabel(w.season)} {w.year}{w === cur ? ' · now' : ''}
          </a>
        ))}
      </nav>
      <AdSlot slot="top" />
      {groups.map(([label, shows]) =>
        shows.length ? (
          <section key={label} className="section">
            <div className="section-head"><h2>{label} <small className="muted">({shows.length})</small></h2></div>
            <ShowGrid shows={shows} eager={label === 'TV series' ? 6 : 0} />
          </section>
        ) : null,
      )}
      {continuing.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Still airing from earlier seasons</h2></div>
          <ShowGrid shows={continuing} />
        </section>
      )}
      {!list.length && <div className="glass empty section">The {name} chart fills in after the daily catalog update.</div>}
      <p className="meta credit-line">Show data from <a href="https://anilist.co" target="_blank" rel="noopener">AniList</a>.</p>
    </div>
  );
}
