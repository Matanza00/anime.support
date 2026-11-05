import ContestCard from '@/components/studio/ContestCard';
import { publishedContests, CATEGORY_LABEL } from '@/lib/contests-db';
import { JsonLd, breadcrumbs } from '@/lib/seo';

export const metadata = {
  title: 'Anime art contests: 2D art, 3D characters, 3D environments and animation',
  description: 'Free monthly anime art contests on anime.support. Upload your original 2D art, 3D character, 3D environment or animation, get votes and fans, and win prizes.',
  alternates: { canonical: '/contests/' },
};

const STEPS = [
  ['Sign in', 'One tap with Google or Apple. Free, no forms.'],
  ['Upload', 'One original piece per contest: art, a 3D model people can spin, or a short animation.'],
  ['Get votes', 'When entries close, the public votes for a week. Share your entry with your fans.'],
  ['Win', '1st place wins the prize after a quick originality check, and gets featured on the home page.'],
];

const CATS = [
  ['2d-art', 'Illustration, character design, key visuals and fan-favourite anime styles.'],
  ['3d-character', 'Sculpted or modelled characters and mecha, viewable in 3D right in the browser.'],
  ['3d-environment', 'Scenes, rooms and cities in an anime style, as a 3D scene, render or fly-through.'],
  ['motion', 'Short original animation: 2D sakuga, 3D, effects, motion graphics.'],
];

export default async function Contests() {
  const list = await publishedContests();
  return (
    <div className="wrap">
      <JsonLd data={breadcrumbs([['Home', '/'], ['Contests', '/contests/']])} />
      <header className="page-head">
        <p className="eyebrow">Creator Studio</p>
        <h1>Anime art contests</h1>
        <p>Every month: four free contests for 2D artists, 3D character and environment artists, and animators. The community votes, and the winner takes the prize.</p>
        <div className="tabs" style={{ marginTop: 16 }}>
          <a className="btn" href="/account/">Join free</a>
          <a className="btn ghost" href="/contests/rules/">Official rules</a>
        </div>
      </header>

      <section className="section">
        <div className="section-head"><h2>{list.length ? 'Contests' : 'First contests open soon'}</h2></div>
        {list.length ? (
          <div className="contest-grid">{list.map((c) => <ContestCard key={c.slug} c={c} label={CATEGORY_LABEL[c.category]} />)}</div>
        ) : (
          <div className="contest-grid">
            {CATS.map(([k, d]) => (
              <div key={k} className="contest-card glass">
                <span className="cat">{CATEGORY_LABEL[k]}</span>
                <h3>Opening soon</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head"><h2>How it works</h2></div>
        <ol className="steps">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="glass"><span className="n">{i + 1}</span><strong>{t}</strong><span>{d}</span></li>
          ))}
        </ol>
      </section>

      <section className="section">
        <div className="section-head"><h2>Fair play</h2></div>
        <div className="glass panel prose">
          <ul>
            <li>Original work only: your own characters and worlds. No tracing, no generative AI.</li>
            <li>Every entry is checked by a moderator before it appears.</li>
            <li>Each person gets 3 votes per contest; vote counts stay hidden until voting ends; fake accounts and vote buying get entries disqualified.</li>
            <li>The top entry by public vote is verified (work-in-progress files, eligibility) before the prize is paid.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
