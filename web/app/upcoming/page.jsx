import Listing, { sectionMetadata } from '@/components/Listing';
import PremiereCard from '@/components/PremiereCard';
import { ShowGrid } from '@/components/ShowCard';
import { premieres } from '@/lib/catalog';

export const metadata = {
  ...sectionMetadata('upcoming'),
  title: 'Upcoming anime: new seasons, films and release dates',
  description: 'Every upcoming anime that has been officially announced: premiering soon with countdowns, the most anticipated new seasons and films, and the latest announcement news.',
};

export default async function Page() {
  const { dated, month, later } = await premieres();
  const soon = dated.slice(0, 12);
  const anticipated = [...month, ...later].sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 18);
  return (
    <Listing section="upcoming" newsTitle="Latest announcements">
      {soon.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Premiering soon</h2><a href="/calendar/">Full release calendar →</a></div>
          <div className="prem-grid">{soon.map((s) => <PremiereCard key={s.id} show={s} />)}</div>
        </section>
      )}
      {anticipated.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Most anticipated</h2></div>
          <ShowGrid shows={anticipated} />
        </section>
      )}
    </Listing>
  );
}
