// Shared section page: News, Upcoming, Out now, Features. 24 stories per page, numbered pages.
import Card from './Card';
import AdSlot from './AdSlot';
import { MostRead, TrendingChart } from './Widgets';
import { allArticles } from '@/lib/db';
import { CATEGORIES } from '@/lib/site';
import { JsonLd, breadcrumbs } from '@/lib/seo';

export const PER_PAGE = 24;

const SECTIONS = {
  all: { label: 'All anime news', path: '/news/', blurb: 'Every story we have published, newest first.', filter: () => true },
  upcoming: { ...CATEGORIES.upcoming, filter: (a) => a.category === 'upcoming' },
  release: { ...CATEGORIES.release, filter: (a) => a.category === 'release' },
  feature: { ...CATEGORIES.feature, filter: (a) => a.category === 'feature' },
};

export async function sectionItems(key) {
  return (await allArticles()).filter(SECTIONS[key].filter);
}

export async function pageParams(key) {
  const pages = Math.ceil((await sectionItems(key)).length / PER_PAGE);
  const list = Array.from({ length: Math.max(0, pages - 1) }, (_, i) => ({ n: String(i + 2) }));
  return list.length ? list : [{ n: '2' }]; // static export needs one path; it renders as an empty page 2
}

export function sectionMetadata(key, n = 1) {
  const s = SECTIONS[key];
  const path = n > 1 ? `${s.path}page/${n}/` : s.path;
  return {
    title: n > 1 ? `${s.label} – page ${n}` : s.label,
    description: s.blurb,
    alternates: { canonical: path },
    robots: n > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function Listing({ section, page = 1, children, newsTitle }) {
  const s = SECTIONS[section];
  const items = await sectionItems(section);
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const slice = items.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const href = (n) => (n <= 1 ? s.path : `${s.path}page/${n}/`);

  return (
    <div className="wrap">
      <JsonLd data={breadcrumbs([['Home', '/'], [s.label, s.path]])} />
      <header className="page-head">
        <p className="eyebrow">Section</p>
        <h1>{s.label}</h1>
        <p>{s.blurb}</p>
      </header>
      {page === 1 && children}
      <div className="two-col section">
        <div>
          <AdSlot slot="top" />
          {page === 1 && newsTitle && <div className="section-head"><h2>{newsTitle}</h2></div>}
          {slice.length ? (
            <div className="grid">{slice.map((a) => <Card key={a.id} article={a} />)}</div>
          ) : (
            <div className="glass empty">{children ? 'Announcement stories appear here once they are published.' : 'No stories here yet. Check back soon.'}</div>
          )}
          {pages > 1 && (
            <nav className="pager" aria-label="Pages">
              {page > 1 && <a className="btn ghost" href={href(page - 1)}>← Newer</a>}
              <span className="chip" aria-current="page">Page {page} of {pages}</span>
              {page < pages && <a className="btn ghost" href={href(page + 1)}>Older →</a>}
            </nav>
          )}
        </div>
        <aside className="sidebar" aria-label="Trending">
          <MostRead />
          <TrendingChart limit={8} />
        </aside>
      </div>
    </div>
  );
}
