import StaticPage from '@/components/StaticPage';
import { SITE } from '@/lib/site';

export const metadata = { title: 'Contact', description: `Contact the ${SITE.name} team for news tips, corrections or partnerships.`, alternates: { canonical: '/contact/' } };

export default function Contact() {
  return (
    <StaticPage eyebrow="Contact" title="Contact us">
      <p>We read every message. Email us at <a href={`mailto:${SITE.email}`}>{SITE.email}</a> for:</p>
      <ul>
        <li><strong>News tips:</strong> announcements we may have missed.</li>
        <li><strong>Corrections:</strong> include the article link and what needs fixing.</li>
        <li><strong>Copyright or removal requests:</strong> include the URL and proof of ownership. We respond within 48 hours.</li>
        <li><strong>Partnerships and advertising.</strong></li>
      </ul>
    </StaticPage>
  );
}
