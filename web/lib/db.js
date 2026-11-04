// Build-time data access. Runs during `next build` only; pages are then plain HTML.
import { slugify } from './site.js';
import { d1Configured, query, parseRow } from './d1.js';

const FIELDS =
  'id, slug, title, excerpt, body_md, category, anime, source_urls, source_names, published_at, updated_at, views, cover_url, cover_credit, media, release_date';

let articlesCache;
let trendingCache;

/** Every published article, newest first. Fetched once per build. */
export async function allArticles() {
  if (articlesCache) return articlesCache;
  // SAMPLE_DATA=1 npm run dev → preview the design with made-up stories
  if (process.env.SAMPLE_DATA === '1') return (articlesCache = (await import('./sample.js')).SAMPLE);
  if (!d1Configured()) {
    console.warn('[db] CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN missing: building with no articles.');
    return (articlesCache = []);
  }
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const page = await query(`SELECT ${FIELDS} FROM articles WHERE status = 'published' ORDER BY published_at DESC LIMIT 500 OFFSET ?`, [offset]);
    rows.push(...page.map(parseRow));
    if (page.length < 500) break;
  }
  return (articlesCache = rows);
}

export async function getArticle(slug) {
  return (await allArticles()).find((a) => a.slug === slug) ?? null;
}

/** Most-read stories from the last 7 days (falls back to newest). */
export async function mostRead(limit = 5) {
  const all = await allArticles();
  const weekAgo = Date.now() - 7 * 864e5;
  const recent = all.filter((a) => new Date(a.published_at).getTime() > weekAgo && a.views > 0);
  const ranked = [...recent].sort((a, b) => b.views - a.views);
  return (ranked.length >= 3 ? ranked : all).slice(0, limit);
}

export async function byCategory(cat, limit = Infinity) {
  return (await allArticles()).filter((a) => a.category === cat).slice(0, limit);
}

/** Confirmed future release dates, soonest first. */
export async function upcomingReleases(limit = Infinity) {
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set();
  return (await allArticles())
    .filter((a) => a.release_date && a.release_date >= today)
    .sort((a, b) => a.release_date.localeCompare(b.release_date))
    .filter((a) => {
      const k = `${a.anime?.[0]}|${a.release_date}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit);
}

/** One hub per anime: { name, slug, count, views, latest, cover, articles }. */
export async function animeHubs() {
  const map = new Map();
  for (const a of await allArticles()) {
    for (const name of a.anime ?? []) {
      const slug = slugify(name);
      if (!slug) continue;
      if (!map.has(slug)) map.set(slug, { name, slug, count: 0, views: 0, latest: a.published_at, cover: null, articles: [] });
      const hub = map.get(slug);
      hub.count++;
      hub.views += a.views;
      hub.cover ||= a.cover_url;
      hub.articles.push(a);
    }
  }
  return [...map.values()].sort((a, b) => b.views - a.views || b.count - a.count);
}

export async function related(article, limit = 4) {
  const tags = new Set(article.anime ?? []);
  const all = await allArticles();
  const same = all.filter((a) => a.id !== article.id && (a.anime ?? []).some((t) => tags.has(t)));
  const fill = all.filter((a) => a.id !== article.id && a.category === article.category && !same.includes(a));
  return [...same, ...fill].slice(0, limit);
}

/**
 * "Trending anime this week" chart: weights the bot computes from AniList trending and your own
 * view counts (table anime_focus). Falls back to the anime with the most coverage.
 */
export async function trendingAnime(limit = 10) {
  if (trendingCache) return trendingCache.slice(0, limit);
  let rows = [];
  if (d1Configured() && process.env.SAMPLE_DATA !== '1') {
    rows = await query('SELECT name, weight, views_7d FROM anime_focus ORDER BY weight DESC LIMIT 30').catch(() => []);
  }
  const hubs = await animeHubs();
  const bySlug = new Map(hubs.map((h) => [h.slug, h]));
  let list = rows.map((r) => ({ name: r.name, slug: slugify(r.name), hub: bySlug.get(slugify(r.name)) ?? null }));
  if (list.length < 5) list = hubs.map((h) => ({ name: h.name, slug: h.slug, hub: h }));
  trendingCache = list;
  return list.slice(0, limit);
}
