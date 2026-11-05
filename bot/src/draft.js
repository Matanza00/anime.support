// Step 2: group new headlines into stories, pick the most promising, and have the AI draft them.
// Drafts land in the review queue (status = 'draft'); nothing goes live without your approval.
import * as cheerio from 'cheerio';
import { sql, insert, marks, now } from './d1.js';
import { CONFIG } from './config.js';
import { chatJSON } from './llm.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts.js';
import { clusterItems, clusterKeyFor, similarity, slugify, extractText, tokens } from './text.js';
import { log, warn } from './log.js';
import { mediaFromPage, buildMedia } from './media.js';
import { createArtwork } from './artwork.js';
import { allowedByRobots } from './robots.js';

const VALID_CATEGORIES = new Set(['news', 'upcoming', 'release', 'feature']);

/** Accepts only a real YYYY-MM-DD date, else null (the calendar must never show a guessed date). */
export function validDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
}

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

/** Same story already covered? Compares headlines (and anime names) with the last few days. */
export function findDuplicate({ title, anime = [] }, recent) {
  const names = new Set(anime.map((a) => String(a).toLowerCase()));
  for (const r of recent) {
    const sim = similarity(title, r.title);
    let rAnime = [];
    try {
      rAnime = typeof r.anime === 'string' ? JSON.parse(r.anime) : r.anime || [];
    } catch {}
    const sameShow = rAnime.some((a) => names.has(String(a).toLowerCase()));
    if (sim >= 0.7 || (sameShow && sim >= 0.5)) return r.title;
  }
  return null;
}

/**
 * Optional auto-publish (repo variable AUTO_PUBLISH=on). Only drafts the AI rates as well supported
 * (confidence >= AUTO_PUBLISH_MIN_CONFIDENCE, default 0.85), and at most AUTO_PUBLISH_MAX_PER_DAY a day.
 * Everything else still waits for you in the dashboard.
 */
async function shouldAutoPublish(out) {
  if (!CONFIG.autoPublish.on) return false;
  if (typeof out.confidence !== 'number' || out.confidence < CONFIG.autoPublish.minConfidence) return false;
  const since = new Date(Date.now() - 864e5).toISOString();
  const { n } = (await sql("SELECT COUNT(*) AS n FROM articles WHERE status = 'published' AND published_at >= ? AND cluster_key IS NOT NULL", [since]))[0];
  return n < CONFIG.autoPublish.maxPerDay;
}

export async function draft() {
  const since = new Date(Date.now() - CONFIG.maxItemAgeHours * 3600e3).toISOString();
  const items = await sql(
    `SELECT r.id, r.source_id, r.url, r.title, r.summary, r.published_at, r.fetched_at, s.name AS source_name
       FROM raw_items r JOIN sources s ON s.id = r.source_id
      WHERE r.status = 'new' AND r.fetched_at >= ?
      ORDER BY r.fetched_at DESC LIMIT 300`,
    [since],
  );
  if (!items.length) return log('Draft: no new headlines'), 0;

  const recentArticles = await sql("SELECT title, cluster_key, anime FROM articles WHERE created_at >= ? AND status != 'rejected'", [
    new Date(Date.now() - 4 * 864e5).toISOString(),
  ]);
  const focus = await sql('SELECT name, weight FROM anime_focus');
  const mark = (status, ids, clusterKey = null) =>
    sql(`UPDATE raw_items SET status = ?, cluster_key = COALESCE(?, cluster_key) WHERE id IN (${marks(ids)})`, [status, clusterKey, ...ids]);

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
      await mark('skipped', ids);
      continue;
    }
    if (made >= CONFIG.maxDraftsPerRun) break; // the rest wait for the next run

    const material = await Promise.all(
      cluster.slice(0, 3).map(async (it) => {
        const page = await fetchPage(it.url);
        return { ...it, page_text: page.text, page };
      }),
    );

    let out;
    try {
      // The AI also sees recent titles, so the same story under another name (EN vs JP title) is skipped.
      out = await chatJSON(SYSTEM_PROMPT, buildUserPrompt(material, recentArticles.slice(-60).map((a) => a.title)));
    } catch (err) {
      warn(`Draft failed for "${lead.title}": ${err.message}`);
      continue; // stays 'new', retried next run
    }

    if (out.skip || !out.title || !out.body_markdown) {
      log(`Skipped "${lead.title}": ${out.skip_reason || 'empty output'}`);
      await mark('skipped', ids);
      continue;
    }

    const anime = (Array.isArray(out.anime) ? out.anime : []).slice(0, 3).map(String);

    // Hard duplicate check on the AI's own headline (catches the same story from a different source).
    const twin = findDuplicate({ title: String(out.title), anime }, recentArticles);
    if (twin) {
      log(`Skipped duplicate "${out.title}" (already have "${twin}")`);
      await mark('skipped', ids);
      continue;
    }

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
    const publishNow = await shouldAutoPublish(out);
    await insert('articles', {
          slug,
          title: String(out.title).slice(0, 140),
          excerpt: String(out.excerpt || '').slice(0, 220),
          body_md: out.body_markdown,
          category,
          social_card_url: art.social_card_url,
          release_date: validDate(out.release_date),
          image_prompt: out.image_prompt || null,
          anime,
          ...mediaInfo,
          source_urls: material.map((m) => m.url),
          source_names: material.map((m) => m.source_name || new URL(m.url).hostname),
          cluster_key: key,
          priority: Number(score.toFixed(3)),
          confidence: typeof out.confidence === 'number' ? out.confidence : null,
          fb_caption: out.facebook_caption || null,
          status: publishNow ? 'published' : 'draft',
          published_at: publishNow ? now() : null,
          created_at: now(),
          updated_at: now(),
        });
    await mark('drafted', ids, key);
    if (publishNow) await sql('UPDATE sources SET items_used = items_used + 1 WHERE id IN (SELECT DISTINCT source_id FROM raw_items WHERE cluster_key = ?)', [key]);
    recentArticles.push({ title: out.title, cluster_key: key, anime: JSON.stringify(anime) });
    made++;
    log(`${publishNow ? 'Auto-published' : 'Drafted'}: ${out.title}`);
  }
  log(`Draft done: ${made} new drafts waiting for review`);
  return made;
}
