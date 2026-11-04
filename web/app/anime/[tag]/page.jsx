// Evergreen hub per anime: "everything confirmed so far". These keep ranking after news posts fade.
import { notFound } from 'next/navigation';
import Card from '@/components/Card';
import Cover from '@/components/Cover';
import AdSlot from '@/components/AdSlot';
import { ReleaseCard, TrendingChart } from '@/components/Widgets';
import { animeHubs } from '@/lib/db';
import { absUrl, formatDate } from '@/lib/site';
import { JsonLd, breadcrumbs } from '@/lib/seo';

export const dynamicParams = false;

async function hub(tag) {
  return (await animeHubs()).find((h) => h.slug === tag) ?? null;
}

export async function generateStaticParams() {
  const list = (await animeHubs()).map((h) => ({ tag: h.slug }));
  return list.length ? list : [{ tag: '__none' }];
}

export async function generateMetadata({ params }) {
  const h = await hub((await params).tag);
  if (!h) return { title: 'Not found', robots: { index: false } };
  const title = `${h.name}: news, release date and everything confirmed`;
  return {
    title,
    description: `Everything officially confirmed about ${h.name}: new seasons, release dates, cast and story news. Updated ${formatDate(h.latest)}.`,
    alternates: { canonical: `/anime/${h.slug}/` },
    openGraph: { title, images: h.cover ? [absUrl(h.cover)] : undefined },
  };
}

export default async function AnimeHub({ params }) {
  const h = await hub((await params).tag);
  if (!h) notFound();
  const today = new Date().toISOString().slice(0, 10);
  const dated = h.articles.filter((a) => a.release_date && a.release_date >= today).sort((a, b) => a.release_date.localeCompare(b.release_date));
  return (
    <div className="wrap section">
      <JsonLd
        data={[
          breadcrumbs([['Home', '/'], ['Anime A–Z', '/anime/'], [h.name, `/anime/${h.slug}/`]]),
          { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${h.name} news`, url: absUrl(`/anime/${h.slug}/`) },
        ]}
      />
      <nav aria-label="Breadcrumb"><ol className="crumbs"><li><a href="/">Home</a></li><li><a href="/anime/">Anime A–Z</a></li></ol></nav>
      <header className="glass" style={{ overflow: 'hidden' }}>
        <Cover label={h.name} image={h.cover} eager className="hub-cover" />
        <div className="article-head" style={{ background: 'none', border: 0 }}>
          <p className="eyebrow">Everything confirmed so far</p>
          <h1>{h.name}</h1>
          <p className="meta">{h.count} {h.count === 1 ? 'story' : 'stories'} · updated {formatDate(h.latest)}</p>
        </div>
      </header>
      <AdSlot slot="top" />
      <div className="two-col section">
        <div>
          {dated.length > 0 && (
            <section className="section" style={{ paddingTop: 0 }}>
              <div className="section-head"><h2>Coming up</h2></div>
              <div className="releases">{dated.map((a) => <ReleaseCard key={a.id} article={a} />)}</div>
            </section>
          )}
          <div className="section-head"><h2>All {h.name} news</h2></div>
          <div className="grid">{h.articles.map((a) => <Card key={a.id} article={a} />)}</div>
        </div>
        <aside className="sidebar"><TrendingChart limit={8} /></aside>
      </div>
    </div>
  );
}
