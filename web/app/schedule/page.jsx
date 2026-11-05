import Schedule from '@/components/Schedule';
import AdSlot from '@/components/AdSlot';
import { scheduleData } from '@/lib/catalog';
import { JsonLd, breadcrumbs } from '@/lib/seo';

export const metadata = {
  title: 'Anime airing schedule this week (in your time zone)',
  description: 'Every new anime and donghua episode airing this week, day by day, in your own time zone, with a live countdown and where to watch.',
  alternates: { canonical: '/schedule/' },
};

export default async function SchedulePage() {
  const slots = await scheduleData();
  return (
    <div className="wrap">
      <JsonLd data={breadcrumbs([['Home', '/'], ['Airing schedule', '/schedule/']])} />
      <header className="page-head">
        <p className="eyebrow">This week</p>
        <h1>Anime airing schedule</h1>
        <p>New episodes for the next seven days, shown in your time zone. Tap a show for where to watch it legally.</p>
      </header>
      <AdSlot slot="top" />
      <Schedule slots={slots} builtAt={Math.floor(Date.now() / 1000)} />
      <p className="meta credit-line">Air times from <a href="https://anilist.co" target="_blank" rel="noopener">AniList</a>, refreshed daily.</p>
    </div>
  );
}
