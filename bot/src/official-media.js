// Covers made from OFFICIAL media instead of generated artwork:
//   1. a still from the official trailer/PV embedded in the source story (YouTube thumbnail, 16:9)
//   2. the show's key visual from AniList, placed on a blurred backdrop of itself (1600×900)
//   3. the show's AniList banner
// The image is saved to our own media store (fast, stable URL for Google Discover and Facebook) and is
// always credited to its owner. Generated artwork is only the fallback when nothing official exists.
import sharp from 'sharp';
import { uploadBuffer } from './storage.js';
import { socialCard } from './artwork.js';
import { CONFIG } from './config.js';
import { log, warn } from './log.js';

async function get(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': CONFIG.userAgent }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Best available thumbnail of a YouTube video, at least 640px wide (YouTube serves a 120px placeholder when a size is missing). */
async function youtubeStill(id) {
  for (const name of ['maxresdefault', 'sddefault', 'hqdefault']) {
    const buf = await get(`https://i.ytimg.com/vi/${id}/${name}.jpg`);
    if (!buf) continue;
    const meta = await sharp(buf).metadata().catch(() => null);
    if (meta?.width >= 640) {
      // hq/sd thumbnails are 4:3 with black bars: crop to the 16:9 picture
      const img = sharp(buf);
      if (meta.width / meta.height < 1.5) {
        const h = Math.round((meta.width * 9) / 16);
        img.extract({ left: 0, top: Math.round((meta.height - h) / 2), width: meta.width, height: h });
      }
      return img.resize(1600, 900, { fit: 'cover' }).webp({ quality: 84 }).toBuffer();
    }
  }
  return null;
}

/** Portrait key visual centred on a blurred, darkened copy of itself, 1600×900. */
async function posterHero(buf) {
  const bg = await sharp(buf).resize(1600, 900, { fit: 'cover' }).blur(28).modulate({ brightness: 0.55, saturation: 1.15 }).toBuffer();
  const fg = await sharp(buf).resize({ height: 900, width: 1100, fit: 'inside' }).toBuffer();
  const { width, height } = await sharp(fg).metadata();
  return sharp(bg).composite([{ input: fg, left: Math.round((1600 - width) / 2), top: Math.round((900 - height) / 2) }]).webp({ quality: 84 }).toBuffer();
}

async function wideHero(buf) {
  const meta = await sharp(buf).metadata();
  if (meta.width / meta.height > 2.2) {
    // banners are very wide: letterbox them on their own blurred copy so nothing important is cropped
    const bg = await sharp(buf).resize(1600, 900, { fit: 'cover' }).blur(30).modulate({ brightness: 0.5 }).toBuffer();
    const fg = await sharp(buf).resize({ width: 1600 }).toBuffer();
    const h = (await sharp(fg).metadata()).height;
    return sharp(bg).composite([{ input: fg, left: 0, top: Math.round((900 - h) / 2) }]).webp({ quality: 84 }).toBuffer();
  }
  return sharp(buf).resize(1600, 900, { fit: 'cover' }).webp({ quality: 84 }).toBuffer();
}

const ytId = (url) => /(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/.exec(url || '')?.[1] ?? null;

/** Ordered list of official image options for a draft, from its media and candidates. */
export function officialOptions({ media = [], image_candidates = [] }) {
  const out = [];
  for (const m of media) if (m.type === 'youtube' && ytId(m.url)) out.push({ kind: 'youtube', id: ytId(m.url), credit: 'Still from the official video · YouTube', story: m.from !== 'anilist' });
  for (const c of image_candidates) {
    if (c.kind === 'image' && /anilist banner/i.test(c.from || '')) out.push({ kind: 'banner', url: c.url, credit: c.credit });
    if (c.kind === 'image' && /anilist cover/i.test(c.from || '')) out.push({ kind: 'poster', url: c.url, credit: c.credit });
    if (c.kind === 'youtube' && ytId(c.url)) out.push({ kind: 'youtube', id: ytId(c.url), credit: `Still from the trailer · ${c.credit || 'YouTube'}`, story: false });
  }
  // a still from the story's own video first, then the key visual, then the banner, then an older trailer
  const rank = { youtube: 0, poster: 1, banner: 2 };
  const seen = new Set();
  return out
    .map((o, i) => ({ ...o, r: o.kind === 'youtube' && !o.story ? 3 : rank[o.kind], i }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .filter((o) => {
      const k = o.id || o.url;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

/**
 * Builds the hero + Facebook card from official media.
 * Returns { cover_url, cover_credit, social_card_url } or null when nothing official is usable.
 */
export async function coverFromOfficialMedia({ slug, title, anime = [], category, media, image_candidates }) {
  for (const o of officialOptions({ media, image_candidates })) {
    try {
      let hero = null;
      if (o.kind === 'youtube') hero = await youtubeStill(o.id);
      else {
        const buf = await get(o.url);
        if (buf) hero = o.kind === 'poster' ? await posterHero(buf) : await wideHero(buf);
      }
      if (!hero) continue;
      const card = await socialCard({ title, anime: anime[0], category, heroBuffer: hero });
      const v = Date.now().toString(36);
      const [cover_url, social_card_url] = await Promise.all([
        uploadBuffer(hero, `articles/${slug}/official-${v}.webp`, 'image/webp'),
        uploadBuffer(card, `articles/${slug}/card-${v}.jpg`, 'image/jpeg'),
      ]);
      log(`Official image (${o.kind}) used for ${slug}`);
      return { cover_url, cover_credit: o.credit, social_card_url };
    } catch (err) {
      warn(`Official image (${o.kind}) failed for ${slug}: ${err.message}`);
    }
  }
  return null;
}

/**
 * One-off and repeatable: replace generated artwork on existing articles with official media.
 * Returns how many published articles changed (they need a redeploy).
 */
export async function remediaExisting({ sql, parseRow }) {
  const rows = (await sql(
    `SELECT id, slug, title, anime, category, status, media, image_candidates, cover_credit FROM articles
      WHERE status IN ('draft', 'published') AND (cover_credit IS NULL OR cover_credit LIKE '%illustration%' OR cover_credit LIKE 'Illustration%')
      ORDER BY id DESC LIMIT 60`,
  )).map(parseRow);
  let changed = 0;
  let live = 0;
  for (const a of rows) {
    const media = [...(a.media ?? [])];
    const trailer = (a.image_candidates ?? []).find((c) => c.kind === 'youtube');
    if (!media.some((m) => m.type === 'youtube') && trailer) {
      media.push({ type: 'youtube', url: trailer.url, caption: `${String(trailer.credit || '').split(' © ')[0].split(' · ')[0]}: official trailer`, credit: 'YouTube', from: 'anilist' });
    }
    const art = await coverFromOfficialMedia({ slug: a.slug, title: a.title, anime: a.anime, category: a.category, media, image_candidates: a.image_candidates });
    if (!art) continue;
    await sql('UPDATE articles SET cover_url = ?, cover_credit = ?, social_card_url = ?, media = ?, updated_at = ? WHERE id = ?', [
      art.cover_url, art.cover_credit, art.social_card_url, JSON.stringify(media), new Date().toISOString(), a.id,
    ]);
    changed++;
    if (a.status === 'published') live++;
  }
  log(`Official media: ${changed} of ${rows.length} articles now use official images (${live} already live)`);
  return live;
}
