import { createClient } from '@supabase/supabase-js';
import { SITE, slugify } from './site.js';

const FIELDS =
  'id, slug, title, excerpt, body_md, category, anime, source_urls, source_names, published_at, updated_at, views, cover_url, cover_credit, media';

let client = null;
if (SITE.supabaseUrl && SITE.supabaseAnon) {
  client = createClient(SITE.supabaseUrl, SITE.supabaseAnon, { auth: { persistSession: false } });
} else {
  console.warn('[db] Supabase env vars missing: building with no articles.');
}

let cache = null;

/** Every published article, newest first. Fetched once per build. */
export async function allArticles() {
  if (cache) return cache;
  // SAMPLE_DATA=1 npm run dev  → preview the design with made-up stories
  if (import.meta.env.SAMPLE_DATA === '1' || process.env.SAMPLE_DATA === '1') {
    const { SAMPLE } = await import('./sample.js');
    return (cache = SAMPLE);
  }
  if (!client) return (cache = []);
  const rows = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await client
      .from('articles')
      .select(FIELDS)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .range(from, from + page - 1);
    if (error) throw new Error(`[db] ${error.message}`);
    rows.push(...data);
    if (data.length < page) break;
  }
  return (cache = rows);
}

export async function trending(limit = 6) {
  const weekAgo = Date.now() - 7 * 864e5;
  const recent = (await allArticles()).filter((a) => new Date(a.published_at).getTime() > weekAgo);
  return [...recent].sort((a, b) => b.views - a.views).slice(0, limit);
}

export async function byCategory(cats, limit = Infinity) {
  const list = Array.isArray(cats) ? cats : [cats];
  return (await allArticles()).filter((a) => list.includes(a.category)).slice(0, limit);
}

/** One hub per anime: { name, slug, count, latest, articles } sorted by activity. */
export async function animeHubs() {
  const map = new Map();
  for (const a of await allArticles()) {
    for (const name of a.anime ?? []) {
      const slug = slugify(name);
      if (!slug) continue;
      if (!map.has(slug)) map.set(slug, { name, slug, count: 0, views: 0, latest: a.published_at, articles: [] });
      const hub = map.get(slug);
      hub.count++;
      hub.views += a.views;
      hub.articles.push(a);
    }
  }
  return [...map.values()].sort((a, b) => b.views - a.views || b.count - a.count);
}

export async function related(article, limit = 4) {
  const tags = new Set(article.anime ?? []);
  return (await allArticles())
    .filter((a) => a.id !== article.id && (a.anime ?? []).some((t) => tags.has(t)))
    .slice(0, limit);
}
