import { allArticles, animeHubs } from '@/lib/db';
import { absUrl, articlePath } from '@/lib/site';

export const dynamic = 'force-static';

export default async function sitemap() {
  const all = await allArticles();
  const newest = all[0]?.published_at ?? new Date().toISOString();
  const fixed = ['/', '/news/', '/upcoming/', '/releases/', '/features/', '/calendar/', '/anime/', '/about/', '/contact/', '/privacy/', '/terms/'].map((p) => ({
    url: absUrl(p),
    lastModified: newest,
    changeFrequency: p === '/' || p === '/news/' ? 'hourly' : 'weekly',
    priority: p === '/' ? 1 : 0.6,
  }));
  const articles = all.map((a) => ({
    url: absUrl(articlePath(a.slug)),
    lastModified: a.updated_at ?? a.published_at,
    changeFrequency: 'weekly',
    priority: 0.8,
    images: a.cover_url ? [absUrl(a.cover_url)] : undefined,
  }));
  const hubs = (await animeHubs()).map((h) => ({ url: absUrl(`/anime/${h.slug}/`), lastModified: h.latest, changeFrequency: 'daily', priority: 0.7 }));
  return [...fixed, ...articles, ...hubs];
}
