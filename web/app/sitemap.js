import { allArticles } from '@/lib/db';
import { animePages, indexable, seasonWindow, seasonId, LETTERS } from '@/lib/catalog';
import { absUrl, articlePath } from '@/lib/site';

export const dynamic = 'force-static';

export default async function sitemap() {
  const all = await allArticles();
  const newest = all[0]?.published_at ?? new Date().toISOString();
  const fixed = ['/', '/news/', '/upcoming/', '/releases/', '/features/', '/calendar/', '/anime/', '/schedule/', '/donghua/', '/about/', '/contact/', '/privacy/', '/terms/'].map((p) => ({
    url: absUrl(p),
    lastModified: newest,
    changeFrequency: p === '/' || p === '/news/' ? 'hourly' : p === '/schedule/' ? 'daily' : 'weekly',
    priority: p === '/' ? 1 : 0.6,
  }));
  const articles = all.map((a) => ({
    url: absUrl(articlePath(a.slug)),
    lastModified: a.updated_at ?? a.published_at,
    changeFrequency: 'weekly',
    priority: 0.8,
    images: a.cover_url ? [absUrl(a.cover_url)] : undefined,
  }));
  const shows = [...(await animePages()).entries()]
    .filter(([, p]) => indexable(p))
    .map(([slug, p]) => ({
      url: absUrl(`/anime/${slug}/`),
      lastModified: [p.hub?.latest, p.show?.updated_at].filter(Boolean).sort().at(-1) ?? newest,
      changeFrequency: p.show?.status === 'RELEASING' ? 'daily' : 'weekly',
      priority: 0.7,
      images: p.show?.cover_url ? [p.show.cover_url] : p.hub?.cover ? [absUrl(p.hub.cover)] : undefined,
    }));
  const seasons = seasonWindow().map((s) => ({ url: absUrl(`/season/${seasonId(s)}/`), lastModified: newest, changeFrequency: 'daily', priority: 0.6 }));
  const letters = LETTERS.map((l) => ({ url: absUrl(`/anime/browse/${l}/`), lastModified: newest, changeFrequency: 'weekly', priority: 0.3 }));
  return [...fixed, ...articles, ...shows, ...seasons, ...letters];
}
