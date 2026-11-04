import StaticPage from '@/components/StaticPage';
import { SITE } from '@/lib/site';

export const metadata = { title: 'Privacy policy', description: `How ${SITE.name} collects and uses data, including cookies, advertising and embedded content.`, alternates: { canonical: '/privacy/' } };

export default function Privacy() {
  return (
    <StaticPage eyebrow="Legal" title="Privacy policy">
      <p><em>Last updated: November 5, 2026</em></p>
      <p>This policy explains what information {SITE.name} ({SITE.url}) collects and how it is used.</p>
      <h2>Information we collect</h2>
      <p>We do not require accounts and do not ask for personal information. We count page views anonymously to learn which stories readers find useful. If you email us, we receive your email address and message and use them only to reply.</p>
      <h2>Cookies and advertising</h2>
      <p>We use Google AdSense to show ads. Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this website or other websites. Google's use of advertising cookies enables it and its partners to serve ads to you based on your visits to this and other sites on the Internet.</p>
      <p>You may opt out of personalized advertising in <a href="https://www.google.com/settings/ads" rel="noopener" target="_blank">Google Ads Settings</a>, or opt out of some third-party vendors' use of cookies at <a href="https://www.aboutads.info/choices/" rel="noopener" target="_blank">aboutads.info</a>. Learn more about <a href="https://policies.google.com/technologies/partner-sites" rel="noopener" target="_blank">how Google uses data from sites that use its services</a>.</p>
      <p>Visitors in the European Economic Area, the UK and Switzerland are shown a consent message before personalized ads are served and can change their choice at any time.</p>
      <h2>Embedded content</h2>
      <p>Articles may include embedded videos and posts from YouTube, X, Instagram or TikTok. YouTube videos load only when you press play, using YouTube's privacy-enhanced mode. Embedded content behaves as if you visited the other site, and those services may set cookies and collect data under their own privacy policies.</p>
      <h2>Analytics</h2>
      <p>We may use Google Analytics to understand how visitors use the site. It uses cookies to collect anonymous usage data.</p>
      <h2>Children</h2>
      <p>This site is not directed at children under 13, and we do not knowingly collect information from them.</p>
      <h2>Your rights</h2>
      <p>Depending on where you live, you may have the right to access or delete data about you. Contact us at <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p>
      <h2>Changes</h2>
      <p>We may update this policy. The date at the top shows the latest version.</p>
    </StaticPage>
  );
}
