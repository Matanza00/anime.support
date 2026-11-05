import StaticPage from '@/components/StaticPage';
import { SITE } from '@/lib/site';

export const metadata = { title: 'Terms of use', description: `Terms for using ${SITE.name}.`, alternates: { canonical: '/terms/' } };

export default function Terms() {
  return (
    <StaticPage eyebrow="Legal" title="Terms of use">
      <p>By using {SITE.name} you agree to these terms.</p>
      <h2>Content</h2>
      <p>Articles and illustrations on this site are created by {SITE.name}. Anime titles, characters and official artwork are trademarks and copyrights of their respective owners and are referenced for news reporting and commentary.</p>
      <h2>Accounts and what you post</h2>
      <p>You must be 13 or older to create an account. Keep it to one account per person. You are responsible for what you upload and write. Only post work you made yourself and have the right to share. No harassment, hate, sexual content, spam, impersonation or vote manipulation. We may remove content or suspend accounts that break these terms or the <a href="/contests/rules/">contest rules</a>.</p>
      <p>You keep the copyright in your work. You give us a non-exclusive licence to display it on the site and promote it, which ends when you delete it (posts already published about contest results may remain).</p>
      <p>Creator links to support pages (Ko-fi, Patreon and similar) go to services we do not run; we do not handle payments between fans and creators.</p>
      <h2>Accuracy</h2>
      <p>We report official announcements and credible reporting, and link our sources. Release dates and details can change; check official channels for final information.</p>
      <h2>Removal requests</h2>
      <p>If you believe content on this site, including a contest entry, infringes your rights, use the Report button or email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> and we will review it promptly.</p>
      <h2>External links</h2>
      <p>We are not responsible for the content of external sites we link to.</p>
    </StaticPage>
  );
}
