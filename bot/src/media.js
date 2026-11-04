// Finds images, trailers and social posts for a draft.
//  1. AniList (free anime database): official cover art, banner and trailer for each anime.
//     Free for services earning under $150/month; above that AniList asks for a commercial licence.
//  2. The source article pages: YouTube trailers and X/Instagram/TikTok posts they embed,
//     plus their preview image (offered as a candidate only, since the outlet may own that photo).
import { CONFIG } from './config.js';
import { warn } from './log.js';

/** Recognises a URL as an embeddable item. Kept in sync with web/lib/embeds.js. */
export function classifyUrl(raw) {
  let u;
  try {
    u = new URL(String(raw).trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let m;
  if (host === 'youtu.be') return { type: 'youtube', id: u.pathname.slice(1, 12), url: u.href };
  if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    const id = u.searchParams.get('v') || (m = u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/)) && m[1];
    return id ? { type: 'youtube', id, url: `https://www.youtube.com/watch?v=${id}` } : null;
  }
  if ((host === 'x.com' || host === 'twitter.com') && (m = u.pathname.match(/^\/(\w+)\/status\/(\d+)/)))
    return { type: 'x', id: m[2], url: `https://x.com/${m[1]}/status/${m[2]}` };
  if (host === 'instagram.com' && (m = u.pathname.match(/^\/(p|reel)\/([\w-]+)/)))
    return { type: 'instagram', id: m[2], url: `https://www.instagram.com/${m[1]}/${m[2]}/` };
  if (host === 'tiktok.com' && (m = u.pathname.match(/\/video\/(\d+)/))) return { type: 'tiktok', id: m[1], url: u.href };
  if (/\.(mp4|webm)$/i.test(u.pathname)) return { type: 'video', url: u.href };
  if (/\.(jpe?g|png|webp|avif|gif)$/i.test(u.pathname)) return { type: 'image', url: u.href };
  return null;
}

/**
 * Dashboard text box → media items. One per line:  URL | caption | credit
 * Lines that aren't a recognised image/video/post URL are returned in `rejected`.
 */
export function parseMediaLines(text = '') {
  const items = [];
  const rejected = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [url, caption = '', credit = ''] = line.split('|').map((s) => s.trim());
    const item = classifyUrl(url);
    if (item) items.push({ type: item.type, url: item.url, caption, credit });
    else rejected.push(line.trim());
  }
  return { items, rejected };
}

export const mediaToLines = (media = []) =>
  media
    .filter((m) => m.type !== 'html')
    .map((m) => {
      const parts = [m.url, m.caption || '', m.credit || ''];
      while (parts.length > 1 && !parts.at(-1)) parts.pop();
      return parts.join(' | ');
    })
    .join('\n');

/** Media found inside a fetched source page (cheerio instance). */
export function mediaFromPage($, pageUrl) {
  const abs = (h) => {
    try {
      return new URL(h, pageUrl).href;
    } catch {
      return null;
    }
  };
  const ogImage = abs($('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || '');
  const embeds = new Map();
  $('iframe[src], a[href], blockquote[cite]').each((_, el) => {
    const href = abs($(el).attr('src') || $(el).attr('href') || $(el).attr('cite') || '');
    const item = href && classifyUrl(href);
    if (item && ['youtube', 'x', 'instagram', 'tiktok'].includes(item.type) && !embeds.has(item.url)) embeds.set(item.url, item);
  });
  return { ogImage, embeds: [...embeds.values()] };
}

const ANILIST_QUERY = `query ($search: String) {
  Media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
    siteUrl
    title { english romaji }
    coverImage { extraLarge }
    bannerImage
    trailer { id site }
    studios(isMain: true) { nodes { name } }
  }
}`;

const cache = new Map();
let lastCall = 0;

/** Looks an anime up on AniList. Waits between calls to respect the rate limit (30/min). */
export async function anilistLookup(title) {
  const key = String(title).toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const wait = lastCall + 2100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': CONFIG.userAgent },
      body: JSON.stringify({ query: ANILIST_QUERY, variables: { search: title } }),
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json();
    const m = json?.data?.Media ?? null;
    cache.set(key, m);
    return m;
  } catch (err) {
    warn(`AniList lookup failed for "${title}": ${err.message}`);
    return null;
  }
}

/**
 * Builds the draft's media:
 *  - cover: AniList banner (wide) or cover art, credited to the studio
 *  - media: trailers/posts embedded in the source articles (these match the news itself)
 *  - candidates: every other option, for you to pick in the dashboard
 */
export async function buildMedia(animeTitles, pages) {
  const candidates = [];
  const media = [];
  const seen = new Set();
  const addCandidate = (c) => {
    if (c.url && !seen.has(c.url)) {
      seen.add(c.url);
      candidates.push(c);
    }
  };

  for (const t of animeTitles.slice(0, 2)) {
    const m = await anilistLookup(t);
    if (!m) continue;
    const name = m.title?.english || m.title?.romaji || t;
    const studio = m.studios?.nodes?.[0]?.name;
    const credit = `${name}${studio ? ` © ${studio}` : ''} · via AniList`;
    if (m.bannerImage) addCandidate({ kind: 'image', url: m.bannerImage, credit, from: 'AniList banner' });
    if (m.coverImage?.extraLarge) addCandidate({ kind: 'image', url: m.coverImage.extraLarge, credit, from: 'AniList cover' });
    if (m.trailer?.site === 'youtube' && m.trailer.id)
      addCandidate({ kind: 'youtube', url: `https://www.youtube.com/watch?v=${m.trailer.id}`, credit, from: 'AniList trailer (may be an older season)' });
  }

  for (const p of pages) {
    for (const e of p.embeds ?? []) {
      if (media.length < 4 && !media.some((x) => x.url === e.url)) media.push({ type: e.type, url: e.url, caption: '', credit: '' });
    }
    if (p.ogImage) addCandidate({ kind: 'image', url: p.ogImage, credit: `Image: ${p.sourceName}`, from: `${p.sourceName} article image (check rights)` });
  }

  const cover = candidates.find((c) => c.kind === 'image' && c.from.startsWith('AniList')) ?? null;
  return { cover_url: cover?.url ?? null, cover_credit: cover?.credit ?? null, media, image_candidates: candidates };
}
