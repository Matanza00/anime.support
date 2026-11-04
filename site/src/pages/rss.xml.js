import rss from '@astrojs/rss';
import { allArticles } from '../lib/db.js';
import { SITE } from '../lib/site.js';

export async function GET(context) {
  const items = (await allArticles()).slice(0, 50).map((a) => ({
    title: a.title,
    description: a.excerpt,
    pubDate: new Date(a.published_at),
    link: `/news/${a.slug}`,
    categories: a.anime ?? [],
  }));
  return rss({ title: SITE.name, description: SITE.tagline, site: context.site, items });
}
