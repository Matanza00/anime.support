import Logo from './Logo';
import Nav from './Nav';
import AccountButton from './AccountButton';
import { allArticles } from '@/lib/db';
import { articlePath } from '@/lib/site';

export default async function Header() {
  const latest = (await allArticles()).slice(0, 8);
  return (
    <>
      <header className="site-header">
        <div className="wrap bar">
          <Logo />
          <Nav />
          <a className="icon-btn" href="/search/" aria-label="Search">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          </a>
          <AccountButton />
        </div>
      </header>
      {latest.length > 0 && (
        <div className="ticker">
          <div className="wrap">
            <span className="label">Latest</span>
            <div className="viewport">
              {/* duplicated once so the marquee loops seamlessly; the copy is hidden from screen readers */}
              <div className="track">
                {[...latest, ...latest].map((a, i) => (
                  <a key={i} href={articlePath(a.slug)} aria-hidden={i >= latest.length ? true : undefined} tabIndex={i >= latest.length ? -1 : undefined}>
                    {a.title}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
