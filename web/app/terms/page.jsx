import StaticPage from '@/components/StaticPage';
import { SITE } from '@/lib/site';

export const metadata = { title: 'Terms of use', description: `Terms for using ${SITE.name}.`, alternates: { canonical: '/terms/' } };

export default function Terms() {
  return (
    <StaticPage eyebrow="Legal" title="Terms of use">
      <p>By using {SITE.name} you agree to these terms.</p>
      <h2>Content</h2>
      <p>Articles and illustrations on this site are created by {SITE.name}. Anime titles, characters and official artwork are trademarks and copyrights of their respective owners and are referenced for news reporting and commentary.</p>
      <h2>Accuracy</h2>
      <p>We report official announcements and credible reporting, and link our sources. Release dates and details can change; check official channels for final information.</p>
      <h2>Removal requests</h2>
      <p>If you believe content on this site infringes your rights, email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> and we will review it promptly.</p>
      <h2>External links</h2>
      <p>We are not responsible for the content of external sites we link to.</p>
    </StaticPage>
  );
}
