// Step 2: group new headlines into stories, pick the most promising, and have the AI draft them.
// Drafts land in the review queue (status = 'draft'); nothing goes live without your approval.
import * as cheerio from 'cheerio';
import { db, q } from './db.js';
import { CONFIG } from './config.js';
import { chatJSON } from './llm.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts.js';
import { clusterItems, clusterKeyFor, similarity, slugify, extractText, tokens } from './text.js';
import { log, warn } from './log.js';
import { mediaFromPage, buildMedia } from './media.js';
import { createArtwork } from './artwork.js';
import { allowedByRobots } from './robots.js';

const VALID_CATEGORIES = new Set(['news', 'upcoming', 'release', 'feature']);

/** Returns the page's readable text plus any images/videos/posts it embeds. */
async function fetchPage(url) {
  try {
    if (!(await allowedByRobots(url))) return { text: '', ogImage: null, embeds: [] }; // site asks bots not to read it
    const res = await fetch(url, { headers: { 'User-Agent': CONFIG.userAgent }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return { text: '', ogImage: null, embeds: [] };
    const $ = cheerio.load(await res.text());
    const found = mediaFromPage($, url); // before extractText, which strips iframes
    return { text: extractText($), ...found };
  } catch {
    return { text: '', ogImage: null, embeds: [] };
  }
}

/** Score = interest in the anime (from the optimizer) × how many outlets cover it × freshness. */
export function scoreCluster(cluster, focus) {
  const words = tokens(cluster.map((c) => c.title).join(' '));
  let weight = 1;
  for (const f of focus) {
    const ft = tokens(String(f.name).split(/[:–—(]/)[0]); // "Frieren: Beyond Journey's End" → "Frieren"
    if (ft.size && [...ft].every((w) => words.has(w))) weight = Math.max(weight, f.weight);
  }
  const outlets = new Set(cluster.map((c) => c.source_id)).size;
  const newest = Math.max(...cluster.map((c) => new Date(c.published_at ?? c.fetched_at).getTime()));
  const ageH = (Date.now() - newest) / 3600e3;
  const freshness = Math.max(0.2, 1 - ageH / 48);
  return weight * (1 + 0.5 * (outlets - 1)) * freshness;
}

export async function draft() {
  const since = new Date(Date.now() - CONFIG.maxItemAgeHours * 3600e3).toISOString();
  const items = await q(
    db()
      .from('raw_items')
      .select('id, source_id, url, title, summary, published_at, fetched_at, sources(name)')
      .eq('status', 'new')
      .gte('fetched_at', since)
      .order('fetched_at', { ascending: false })
      .limit(300),
  );
  if (!items.length) return log('Draft: no new headlines'), 0;

  const recentArticles = await q(
    db()
      .from('articles')
      .select('title, cluster_key')
      .gte('created_at', new Date(Date.now() - 4 * 864e5).toISOString()),
  );
  const focus = await q(db().from('anime_focus').select('name, weight'));

  const clusters = clusterItems(items)
    .map((c) => ({ items: c, score: scoreCluster(c, focus) }))
    .sort((a, b) => b.score - a.score);

  let made = 0;
  for (const { items: cluster, score } of clusters) {
    const ids = cluster.map((c) => c.id);
    const lead = cluster[0];
    const key = clusterKeyFor(lead.title);

    // Already covered in the last few days? Mark and move on.
    const dupe = recentArticles.some((a) => a.cluster_key === key || similarity(a.title, lead.title) >= 0.75);
    if (dupe) {
      await q(db().from('raw_items').update({ status: 'skipped' }).in('id', ids));
      continue;
    }
    if (made >= CONFIG.maxDraftsPerRun) break; // the rest wait for the next run

    const material = await Promise.all(
      cluster.slice(0, 3).map(async (it) => {
        const page = await fetchPage(it.url);
        return { ...it, source_name: it.sources?.name, page_text: page.text, page };
      }),
    );

    let out;
    try {
      out = await chatJSON(SYSTEM_PROMPT, buildUserPrompt(material));
    } catch (err) {
      warn(`Draft failed for "${lead.title}": ${err.message}`);
      continue; // stays 'new', retried next run
    }

    if (out.skip || !out.title || !out.body_markdown) {
      log(`Skipped "${lead.title}": ${out.skip_reason || 'empty output'}`);
      await q(db().from('raw_items').update({ status: 'skipped' }).in('id', ids));
      continue;
    }

    const anime = (Array.isArray(out.anime) ? out.anime : []).slice(0, 3).map(String);
    const mediaInfo = await buildMedia(
      anime,
      material.map((m) => ({ ...m.page, sourceName: m.source_name || new URL(m.url).hostname })),
    );

    const slug = `${slugify(out.title)}-${Date.now().toString(36).slice(-4)}`;
    const category = VALID_CATEGORIES.has(out.category) ? out.category : 'news';
    const art = await createArtwork({ slug, title: String(out.title), anime, category, imagePrompt: out.image_prompt });
    // Our own unique artwork is the cover; AniList art stays available as an option in the dashboard.
    if (art.cover_url) {
      if (mediaInfo.cover_url) mediaInfo.image_candidates.unshift({ kind: 'image', url: mediaInfo.cover_url, credit: mediaInfo.cover_credit, from: 'AniList' });
      Object.assign(mediaInfo, { cover_url: art.cover_url, cover_credit: art.cover_credit });
    }
    await q(
      db()
        .from('articles')
        .insert({
          slug,
          title: String(out.title).slice(0, 140),
          excerpt: String(out.excerpt || '').slice(0, 220),
          body_md: out.body_markdown,
          category,
          social_card_url: art.social_card_url,
          image_prompt: out.image_prompt || null,
          anime,
          ...mediaInfo,
          source_urls: material.map((m) => m.url),
          source_names: material.map((m) => m.source_name || new URL(m.url).hostname),
          cluster_key: key,
          priority: Number(score.toFixed(3)),
          confidence: typeof out.confidence === 'number' ? out.confidence : null,
          fb_caption: out.facebook_caption || null,
          status: 'draft',
        }),
    );
    await q(db().from('raw_items').update({ status: 'drafted', cluster_key: key }).in('id', ids));
    recentArticles.push({ title: out.title, cluster_key: key });
    made++;
    log(`Drafted: ${out.title}`);
  }
  log(`Draft done: ${made} new drafts waiting for review`);
  return made;
}
