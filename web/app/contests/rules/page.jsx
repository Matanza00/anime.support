import StaticPage from '@/components/StaticPage';
import { SITE } from '@/lib/site';

export const metadata = {
  title: 'Official contest rules',
  description: 'Official rules for anime.support art contests: who can enter, what you can submit, how voting and judging work, prizes and fair play.',
  alternates: { canonical: '/contests/rules/' },
};

export default function Rules() {
  return (
    <StaticPage eyebrow="Creator Studio" title="Official contest rules">
      <p><em>Last updated: November 5, 2026. Each contest page states its own theme, dates and prize; those details form part of these rules.</em></p>
      <p><strong>No purchase or payment is necessary to enter or win.</strong> Entering and voting are free. Paying does not improve your chances.</p>

      <h2>1. Organizer</h2>
      <p>The contests are run by {SITE.name} (&ldquo;we&rdquo;, the &ldquo;Organizer&rdquo;), contact <a href={`mailto:${SITE.email}`}>{SITE.email}</a>. Contests are not sponsored, endorsed or administered by any studio, publisher, Google, Apple or Facebook.</p>

      <h2>2. Who can enter</h2>
      <ul>
        <li>Anyone aged 13 or older with an {SITE.name} account may enter and vote. To receive a cash prize you must be 18 or older, or have written consent from a parent or guardian.</li>
        <li>Void where prohibited by law. People in countries or regions under comprehensive sanctions, or where we cannot legally send a prize, cannot receive one.</li>
        <li>Organizer staff, moderators and their households may enter for fun but cannot win prizes.</li>
        <li>One account per person. Using several accounts disqualifies all of them.</li>
      </ul>

      <h2>3. How to enter</h2>
      <p>Sign in, open a contest while it is taking entries, and upload one entry that follows the contest brief. You can withdraw and replace your entry until entries close. Each entry is checked by a moderator before it appears publicly.</p>

      <h2>4. What you can submit</h2>
      <ul>
        <li><strong>Original work you made yourself.</strong> Unless a contest page says fan art is allowed, characters and settings must be your own creations, not existing anime, game or film characters.</li>
        <li><strong>No generative AI.</strong> Images, models or animation produced by AI generators are not allowed. Using normal software tools is fine.</li>
        <li>No tracing, copying or reposting other people&apos;s work, and no stock assets presented as your own. Credit any licensed assets (for example base meshes or textures) in the description.</li>
        <li>Safe for a general audience: no sexual content, gore, hate or harassment.</li>
        <li>Finalists must be able to show work-in-progress files (layers, sketches, project files or screenshots) within 7 days when asked.</li>
      </ul>

      <h2>5. Your rights</h2>
      <p>You keep the copyright in your work. By entering, you give {SITE.name} a free, worldwide, non-exclusive licence to show your entry, its preview and your name on the site and in posts promoting the contest and its results, for as long as the entry stays on the site. Withdrawing or deleting your entry ends this licence for future use.</p>

      <h2>6. Voting and judging</h2>
      <ul>
        <li>After entries close, public voting runs until the time shown on the contest page. Each account has 3 votes per contest, at most one per entry, and cannot vote for its own entry. Accounts must be at least 24 hours old and have a verified email to vote.</li>
        <li>Entries are ranked by valid votes. Vote counts are hidden until voting ends.</li>
        <li>Votes from fake or duplicate accounts, bots, vote exchanges or paid voting are removed. Entries that benefit from them may be disqualified. Our moderators&apos; decision on vote validity is final.</li>
        <li>The highest-ranked eligible entry is the potential winner until it passes verification: originality, these rules, the contest brief and the winner&apos;s eligibility. If it fails, the next eligible entry moves up.</li>
        <li>Ties are decided by a panel of at least two moderators on originality, craft and fit to the theme.</li>
      </ul>

      <h2>7. Prizes</h2>
      <ul>
        <li>The prize for each contest is stated on its contest page. Cash prizes are paid in US dollars (or local equivalent) within 30 days of verification, by bank transfer, Payoneer, Wise or another method we agree with the winner. We cover our own sending fees.</li>
        <li>Winners are contacted through their account email. If a winner does not reply within 14 days, or cannot legally receive the prize, the prize may go to the next eligible entry.</li>
        <li>Winners are responsible for any taxes on their prize in their country. Prizes cannot be transferred.</li>
        <li>Winners are featured on {SITE.name} with their entry and name or username.</li>
      </ul>

      <h2>8. Changes and cancellation</h2>
      <p>We may change dates, extend a contest or cancel it if something outside our control affects fairness (for example large-scale fraud or a technical failure). If a contest is cancelled after voting has begun, we may award the prize based on the valid votes up to that point. Changes are announced on the contest page.</p>

      <h2>9. Other</h2>
      <p>We are not responsible for lost or corrupted uploads, or for problems with third-party services. Personal data is handled as described in our <a href="/privacy/">privacy policy</a>. A list of winners is available on each contest page and by email on request.</p>
    </StaticPage>
  );
}
