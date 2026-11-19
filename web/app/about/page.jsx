import StaticPage from '@/components/StaticPage';
import { SITE } from '@/lib/site';

export const metadata = { title: 'About us and editorial policy', description: `What ${SITE.name} is, how articles are made, where our information comes from, and how we correct mistakes.`, alternates: { canonical: '/about/' } };

export default function About() {
  return (
    <StaticPage eyebrow="About" title={`About ${SITE.name}`}>
      <p>{SITE.name} is an independent anime news site. We follow official announcements from studios, publishers and streaming services, plus reporting from established anime news outlets, and turn them into clear, quick reads: what was announced, why it matters, and what happens next.</p>
      <h2>How we report</h2>
      <ul>
        <li>Every story is based on an official announcement or a named, established source, linked at the end of the article.</li>
        <li>We write every article in our own words and add context, such as where a show sits in its story or what a new season adapts.</li>
        <li>Rumours and leaks are always labelled as unconfirmed. We never present speculation as fact.</li>
        <li>Release dates appear in our calendar only once they are officially confirmed.</li>
        <li>Major spoilers are hidden behind tap-to-reveal spoiler boxes.</li>
      </ul>
      <h2>How articles are made</h2>
      <p>Most news stories are written with the help of AI. Our system watches official studio, publisher and streaming announcements and established anime news outlets, and drafts a story only when an announcement comes from a named source. Each draft is checked automatically before it goes live: it must cite its sources, stick to what they say and pass a confidence check, or it is not published. Our editor also writes articles by hand, reviews published stories and corrects them when needed.</p>
      <p>Show details (episode counts, studios, air dates and fan scores) come from <a href="https://anilist.co" target="_blank" rel="noopener">AniList</a> and are refreshed daily. Pictures are official promotional images such as key visuals and trailer stills, credited to their owners; we never generate fake &ldquo;official&rdquo; art.</p>
      <h2>Corrections</h2>
      <p>If we get something wrong, we fix it and update the article. Send corrections to <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p>
      <h2>Independence</h2>
      <p>{SITE.name} is a fan-run publication and is not affiliated with any studio, publisher or streaming platform. All trademarks belong to their owners.</p>
    </StaticPage>
  );
}
