import { notFound } from 'next/navigation';
import Cover from '@/components/Cover';
import Card, { Pill } from '@/components/Card';
import AdSlot from '@/components/AdSlot';
import ShareBar from '@/components/ShareBar';
import ArticleClient from '@/components/ArticleClient';
import { MostRead, TrendingChart } from '@/components/Widgets';
import { allArticles, getArticle, related } from '@/lib/db';
import { renderArticle } from '@/lib/markdown';
import { renderMediaList } from '@/lib/embeds';
import { animeHref, pageForName } from '@/lib/catalog';
import GuideLinks from '@/components/GuideLinks';
import { guidesIn, guideType } from '@/lib/guides';
import { coverAlt } from '@/components/Cover';
import { CATEGORIES, SITE, absUrl, articlePath, catLabel, formatDate, readingTime, slugify } from '@/lib/site';
import { JsonLd, breadcrumbs, publisher, ogBase } from '@/lib/seo';

export const dynamicParams = false;
const EMPTY = '__none';

export async function generateStaticParams() {
  const list = (await allArticles()).map((a) => ({ slug: a.slug }));
  return list.length ? list : [{ slug: EMPTY }]; // static export needs at least one path
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) return { title: 'Not found', robots: { index: false } };
  const image = a.cover_url ? absUrl(a.cover_url) : undefined;
  return {
    title: a.title,
    description: a.excerpt,
    alternates: { canonical: articlePath(a.slug) },
    keywords: a.anime,
    openGraph: {
      ...ogBase,
      type: 'article',
      title: a.title,
      description: a.excerpt,
      url: articlePath(a.slug),
      publishedTime: a.published_at,
      modifiedTime: a.updated_at ?? a.published_at,
      section: catLabel(a.category),
      tags: a.anime,
      images: image ? [{ url: image, width: 1600, height: 900, alt: a.title }] : undefined,
    },
    twitter: { card: 'summary_large_image', title: a.title, description: a.excerpt, images: image ? [image] : undefined },
  };
}

export default async function ArticlePage({ params }) {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) notFound();

  const scripts = new Set();
  const { before, after, toc, faq } = renderArticle(a.body_md, scripts);
  const mediaHtml = renderMediaList(a.media ?? [], scripts);
  const more = await related(a, 3);
  const url = absUrl(articlePath(a.slug));
  const cat = CATEGORIES[a.category] ?? CATEGORIES.news;

  const hrefs = Object.fromEntries(await Promise.all((a.anime ?? []).map(async (n) => [n, await animeHref(n)])));
  const show = a.anime?.[0];
  const crumbs = [['Home', '/'], [cat.label, cat.path], ...(show ? [[show, hrefs[show]]] : []), [a.title, articlePath(a.slug)]];
  // the show's guide cluster: shown under guides (as siblings) and under news about the show
  const showPage = show ? await pageForName(show) : null;
  const guides = guidesIn(showPage?.hub?.articles);
  const isGuide = Boolean(guideType(a));
  const otherGuides = guides.filter((g) => g.article.slug !== a.slug);
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: a.title,
      description: a.excerpt,
      datePublished: a.published_at,
      dateModified: a.updated_at ?? a.published_at,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      url,
      inLanguage: 'en',
      isAccessibleForFree: true,
      image: a.cover_url ? [{ '@type': 'ImageObject', url: absUrl(a.cover_url), width: 1600, height: 900, caption: a.cover_credit || undefined }] : undefined,
      articleSection: cat.label,
      keywords: (a.anime ?? []).join(', ') || undefined,
      author: { '@type': 'Organization', name: `${SITE.name} Newsroom`, url: absUrl('/about/'), parentOrganization: { '@id': publisher['@id'] } },
      publisher,
      about: (a.anime ?? []).map((name) => ({ '@type': 'CreativeWork', name })),
      isBasedOn: a.source_urls?.length ? a.source_urls : undefined,
    },
    breadcrumbs(crumbs),
    ...(faq.length >= 2
      ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }]
      : []),
  ];

  return (
    <div className="wrap section">
      <JsonLd data={jsonLd} />
      <ArticleClient slug={a.slug} scripts={[...scripts]} />

      <nav aria-label="Breadcrumb">
        <ol className="crumbs">
          <li><a href="/">Home</a></li>
          <li><a href={cat.path}>{cat.label}</a></li>
          {a.anime?.[0] && <li><a href={hrefs[a.anime[0]]}>{a.anime[0]}</a></li>}
        </ol>
      </nav>

      <div className="two-col">
        <article>
          <header className="article-head glass">
            <Pill category={a.category} />
            <h1>{a.title}</h1>
            <p className="dek">{a.excerpt}</p>
            <div className="meta">
              <span>{SITE.name} Newsroom</span>
              <time dateTime={a.published_at}>{formatDate(a.published_at)}</time>
              <span>{readingTime(a.body_md)} min read</span>
              {a.release_date && <span>Release: {formatDate(a.release_date)}</span>}
            </div>
            {a.anime?.length > 0 && (
              <div className="tabs" style={{ marginTop: 14, marginBottom: 0 }}>
                {a.anime.map((n) => <a key={n} className="chip" href={hrefs[n]}>{n}</a>)}
              </div>
            )}
            <ShareBar url={url} title={a.title} />
          </header>

          <div className="article-cover">
            <Cover label={a.anime?.[0] ?? cat.label} alt={coverAlt(a)} image={a.cover_url} credit={a.cover_credit} eager />
          </div>

          <AdSlot slot="top" />

          <div className="article-body glass">
            {toc.length >= 3 && (
              <nav className="toc glass" aria-labelledby="toc-h" style={{ marginBottom: 24 }}>
                <h2 id="toc-h">In this story</h2>
                <ol>{toc.map((t) => <li key={t.id}><a href={`#${t.id}`}>{t.text}</a></li>)}</ol>
              </nav>
            )}
            <div className="prose" dangerouslySetInnerHTML={{ __html: before }} />
            {mediaHtml && <div className="media-block" dangerouslySetInnerHTML={{ __html: mediaHtml }} />}
            {after && <AdSlot slot="inArticle" />}
            {after && <div className="prose" style={{ marginTop: '1.15em' }} dangerouslySetInnerHTML={{ __html: after }} />}

            {a.source_urls?.length > 0 && (
              <aside className="sources glass">
                <strong>Sources.</strong> Based on official announcements and reporting from{' '}
                {a.source_urls.map((href, i) => (
                  <span key={href}>
                    <a href={href} rel="noopener nofollow" target="_blank">{a.source_names?.[i] ?? new URL(href).hostname}</a>
                    {i < a.source_urls.length - 1 ? ', ' : '.'}
                  </span>
                ))}{' '}
                Spotted an error? <a href="/contact/">Tell us</a> and we will correct it.
              </aside>
            )}
            <ShareBar url={url} title={a.title} />
          </div>

          {otherGuides.length > 0 && (
            <GuideLinks
              name={show}
              guides={isGuide ? guides : otherGuides}
              current={a.slug}
              hubHref={hrefs[show]}
              title={isGuide ? `Related guides for ${show}` : `${show} guides`}
            />
          )}

          <AdSlot slot="bottom" />

          {more.length > 0 && (
            <section className="section">
              <div className="section-head"><h2>{a.anime?.[0] ? `More on ${a.anime[0]}` : 'Read next'}</h2></div>
              <div className="grid">{more.map((r) => <Card key={r.id} article={r} />)}</div>
            </section>
          )}
        </article>

        <aside className="sidebar" aria-label="More stories">
          <MostRead />
          <TrendingChart limit={8} />
        </aside>
      </div>
    </div>
  );
}
