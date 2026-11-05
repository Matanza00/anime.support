import { allShows } from '@/lib/catalog';
import { ShowGrid } from '@/components/ShowCard';
import AdSlot from '@/components/AdSlot';
import { JsonLd, breadcrumbs } from '@/lib/seo';

export const metadata = {
  title: 'Donghua: Chinese anime airing now and where to watch',
  description: 'Chinese animation (donghua) airing now, coming soon and all-time favourites, with episode countdowns and the official places to watch each show.',
  alternates: { canonical: '/donghua/' },
};

export default async function Donghua() {
  const cn = (await allShows()).filter((s) => s.country === 'CN');
  const airing = cn.filter((s) => s.status === 'RELEASING');
  const soon = cn.filter((s) => s.status === 'NOT_YET_RELEASED');
  const done = cn.filter((s) => s.status === 'FINISHED').slice(0, 36);
  return (
    <div className="wrap">
      <JsonLd data={breadcrumbs([['Home', '/'], ['Donghua', '/donghua/']])} />
      <header className="page-head">
        <p className="eyebrow">Chinese anime</p>
        <h1>Donghua</h1>
        <p>Cultivation epics, martial arts and fantasy from China. Episodes usually stream on Bilibili, Tencent Video (WeTV), iQIYI and YouTube; each page lists the official links.</p>
      </header>
      <AdSlot slot="top" />
      {airing.length > 0 && <section className="section"><div className="section-head"><h2>Airing now</h2><a href="/schedule/">Schedule →</a></div><ShowGrid shows={airing} ranked eager={6} /></section>}
      {soon.length > 0 && <section className="section"><div className="section-head"><h2>Coming soon</h2></div><ShowGrid shows={soon} /></section>}
      {done.length > 0 && <section className="section"><div className="section-head"><h2>Popular completed donghua</h2></div><ShowGrid shows={done} /></section>}
      {!cn.length && <div className="glass empty section">The donghua list fills in after the daily catalog update.</div>}
    </div>
  );
}
