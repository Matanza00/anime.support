import { notFound } from 'next/navigation';
import ContestGallery from '@/components/studio/ContestGallery';
import { publishedContests, CATEGORY_LABEL } from '@/lib/contests-db';
import { JsonLd, breadcrumbs } from '@/lib/seo';

export const dynamicParams = false;
export async function generateStaticParams() {
  const list = (await publishedContests()).map((c) => ({ slug: c.slug }));
  return list.length ? list : [{ slug: '__none' }];
}

const get = async (slug) => (await publishedContests()).find((c) => c.slug === slug);
const fmt = (iso) => new Date(iso).toLocaleString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' UTC';

export async function generateMetadata({ params }) {
  const c = await get((await params).slug);
  if (!c) return { title: 'Contest not found', robots: { index: false } };
  return {
    title: `${c.title}: ${CATEGORY_LABEL[c.category]} contest`,
    description: `${c.theme}. Free to enter${c.prize ? `; prize: ${c.prize}` : ''}. Entries close ${fmt(c.submit_closes_at)}.`.slice(0, 158),
    alternates: { canonical: `/contests/${c.slug}/` },
  };
}

export default async function ContestPage({ params }) {
  const c = await get((await params).slug);
  if (!c) notFound();
  return (
    <div className="wrap">
      <JsonLd data={breadcrumbs([['Home', '/'], ['Contests', '/contests/'], [c.title, `/contests/${c.slug}/`]])} />
      <nav aria-label="Breadcrumb"><ol className="crumbs" style={{ marginTop: 24 }}><li><a href="/">Home</a></li><li><a href="/contests/">Contests</a></li></ol></nav>
      <header className="contest-head glass">
        <p className="eyebrow">{CATEGORY_LABEL[c.category]} contest</p>
        <h1>{c.title}</h1>
        <p className="theme">{c.theme}</p>
        <dl className="contest-facts">
          <div><dt>Prize</dt><dd>{c.prize || 'Announced soon'}</dd></div>
          <div><dt>Entries</dt><dd>{fmt(c.submit_opens_at)} to {fmt(c.submit_closes_at)}</dd></div>
          <div><dt>Public voting</dt><dd>until {fmt(c.vote_closes_at)}</dd></div>
          <div><dt>Rules</dt><dd>{c.allow_fan_art ? 'Original work; fan art allowed' : 'Original characters and worlds only'} · no generative AI · <a href="/contests/rules/">full rules</a></dd></div>
        </dl>
      </header>
      {c.description && (
        <section className="section">
          <div className="glass panel prose">{c.description.split(/\n{2,}/).map((t, i) => <p key={i}>{t}</p>)}</div>
        </section>
      )}
      <ContestGallery slug={c.slug} />
    </div>
  );
}
