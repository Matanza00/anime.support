import { rankingPages, monthName, thisYear } from '@/lib/rankings';
import { JsonLd, breadcrumbs } from '@/lib/seo';
import AdsScript from '@/components/AdsScript';

export const metadata = {
  title: 'Top 10 anime rankings: best anime of the year and month',
  description: 'The best anime of every year and month, the top donghua and the most anticipated upcoming anime, ranked by fan scores and updated daily.',
  alternates: { canonical: '/top/' },
};

export default async function TopIndex() {
  const all = await rankingPages();
  const years = all.filter((p) => p.kind === 'year');
  const special = all.filter((p) => p.kind === 'donghua' || p.kind === 'anticipated');
  const thumbs = (p) => p.items.slice(0, 3).map((s) => s.cover_url).filter(Boolean);
  const Card = ({ p }) => (
    <a className="top-card glass" href={`/top/${p.id}/`}>
      <div className="top-thumbs">{thumbs(p).map((u) => <img key={u} src={u} alt="" loading="lazy" referrerPolicy="no-referrer" />)}</div>
      <h3>{p.title}</h3>
      <p className="meta">#1 {p.items[0].title}</p>
    </a>
  );
  return (
    <div className="wrap">
      <AdsScript />
      <JsonLd data={breadcrumbs([['Home', '/'], ['Top 10', '/top/']])} />
      <header className="page-head">
        <p className="eyebrow">Rankings</p>
        <h1>Top 10 anime rankings</h1>
        <p>The best anime of each year and month, the top donghua and the shows fans are most excited about, ranked by fan scores and updated every day.</p>
      </header>
      {!all.length && <div className="glass empty">Rankings appear after the daily catalog update.</div>}
      {[...years, ...special].length > 0 && (
        <section className="section">
          <div className="section-head"><h2>By year</h2></div>
          <div className="top-grid">{[...years, ...special].map((p) => <Card key={p.id} p={p} />)}</div>
        </section>
      )}
      {years.map((y) => {
        const months = all.filter((p) => p.kind === 'month' && p.year === y.year);
        return months.length ? (
          <section key={y.id} className="section">
            <div className="section-head"><h2>Best anime by month, {y.year}{y.year === thisYear() ? ' so far' : ''}</h2></div>
            <div className="top-grid">{months.map((p) => <Card key={p.id} p={{ ...p, title: `${monthName(p.month)} ${p.year}` }} />)}</div>
          </section>
        ) : null;
      })}
    </div>
  );
}
