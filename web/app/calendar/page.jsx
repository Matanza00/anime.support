import { ReleaseCard } from '@/components/Widgets';
import PremiereCard from '@/components/PremiereCard';
import AdSlot from '@/components/AdSlot';
import { upcomingReleases } from '@/lib/db';
import { premieres } from '@/lib/catalog';
import { formatDate } from '@/lib/site';
import { JsonLd, breadcrumbs } from '@/lib/seo';

export const metadata = {
  title: 'Anime release calendar: every confirmed premiere date',
  description: 'Officially announced premiere dates for upcoming anime series, new seasons and films, with a countdown for each and links to the official announcement channels.',
  alternates: { canonical: '/calendar/' },
};

const monthKey = (d) => d.slice(0, 7);
const monthName = (k) => formatDate(`${k}-01`, { month: 'long', year: 'numeric' });

export default async function Calendar() {
  const news = await upcomingReleases();
  const { dated, month, later } = await premieres();

  // One timeline: exact dates from the database + dates our news stories confirmed
  const months = new Map();
  const add = (k, item) => {
    if (!months.has(k)) months.set(k, { exact: [], news: [], tba: [] });
    months.get(k)[item.type].push(item.v);
  };
  for (const s of dated) add(monthKey(s.start_date), { type: 'exact', v: s });
  for (const a of news) add(monthKey(a.release_date), { type: 'news', v: a });
  for (const s of month) add(monthKey(s.start_date), { type: 'tba', v: s });
  const keys = [...months.keys()].sort();

  return (
    <div className="wrap">
      <JsonLd data={breadcrumbs([['Home', '/'], ['Release calendar', '/calendar/']])} />
      <header className="page-head">
        <p className="eyebrow">Countdown</p>
        <h1>Anime release calendar</h1>
        <p>
          {dated.length} premiere{dated.length === 1 ? '' : 's'} with a confirmed date, {month.length} more with the month announced. Dates come from the
          studios, production committees, broadcasters and streaming services; each card links to the show&apos;s official channels so you can check.
        </p>
      </header>
      <nav className="tabs" aria-label="Months">
        {keys.map((k) => <a key={k} className="chip" href={`#m-${k}`}>{monthName(k)}</a>)}
        {later.length > 0 && <a className="chip" href="#later">Date not announced</a>}
      </nav>
      <AdSlot slot="top" />
      {keys.length === 0 && <div className="glass empty section">No confirmed dates right now. New dates appear here as soon as they are announced.</div>}
      {keys.map((k) => {
        const m = months.get(k);
        return (
          <section key={k} id={`m-${k}`} className="month section">
            <div className="section-head"><h2>{monthName(k)}</h2></div>
            {m.news.length > 0 && <div className="releases" style={{ marginBottom: 16 }}>{m.news.map((a) => <ReleaseCard key={a.id} article={a} />)}</div>}
            {m.exact.length > 0 && <div className="prem-grid">{m.exact.map((s) => <PremiereCard key={s.id} show={s} />)}</div>}
            {m.tba.length > 0 && (
              <>
                <h3 className="sub-head">Coming in {monthName(k)}, exact day not announced</h3>
                <div className="prem-grid">{m.tba.map((s) => <PremiereCard key={s.id} show={s} precision="month" />)}</div>
              </>
            )}
          </section>
        );
      })}
      {later.length > 0 && (
        <section id="later" className="section">
          <div className="section-head"><h2>Announced, date to come</h2></div>
          <div className="prem-grid">{later.slice(0, 60).map((s) => <PremiereCard key={s.id} show={s} precision="later" />)}</div>
        </section>
      )}
      <SourcesNote />
    </div>
  );
}

export function SourcesNote() {
  return (
    <aside className="glass sources-note section">
      <h2>Where release dates come from</h2>
      <p>
        Anime dates are announced by the people making the show: the official website and X account run by the
        production committee, the studio, the original publisher (for example at Jump Festa or in a magazine), the TV
        broadcaster, and the streaming services that license it. Big batches of news land at events like AnimeJapan
        (March), Anime Expo (July) and Jump Festa (December). News sites then report them, and community databases record them.
      </p>
      <p>
        This page updates itself every day from <a href="https://anilist.co" target="_blank" rel="noopener">AniList</a>&apos;s database, plus the
        dates our own news stories confirmed from official announcements. A date marked “day TBA” means only the month has been announced.
      </p>
    </aside>
  );
}
