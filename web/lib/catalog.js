// Build-time access to the anime catalog (table anime_catalog + airing), filled daily by the bot from AniList.
import { slugify } from './site.js';
import { d1Configured, query } from './d1.js';
import { animeHubs } from './db.js';

const COLS =
  'id, slug, title, title_romaji, title_native, synonyms, format, status, episodes, duration, source, season, season_year, start_date, end_date, country, genres, tags, studios, score, popularity, trending, cover_url, cover_color, banner_url, trailer_youtube, streaming, official_site, next_episode, next_airing_at, anilist_url, summary, updated_at';
const JSON_COLS = ['synonyms', 'genres', 'tags', 'studios', 'streaming'];

let showsCache;
let airingCache;
let aliasCache;

function parse(r) {
  const o = { ...r };
  for (const k of JSON_COLS) {
    try {
      o[k] = typeof o[k] === 'string' ? JSON.parse(o[k]) : (o[k] ?? []);
    } catch {
      o[k] = [];
    }
  }
  return o;
}

const useDb = () => d1Configured() && process.env.SAMPLE_DATA !== '1';

/** Every show in the catalog, most popular first. Fetched once per build. */
export async function allShows() {
  if (showsCache) return showsCache;
  if (process.env.SAMPLE_DATA === '1') return (showsCache = (await import('./sample-catalog.js')).SHOWS.map(parse));
  if (!useDb()) return (showsCache = []);
  const rows = [];
  try {
    for (let offset = 0; ; offset += 400) {
      const page = await query(`SELECT ${COLS} FROM anime_catalog ORDER BY popularity DESC LIMIT 400 OFFSET ?`, [offset]);
      rows.push(...page.map(parse));
      if (page.length < 400) break;
    }
  } catch (err) {
    // The catalog table appears after the first "catalog" bot run; build the rest of the site meanwhile.
    console.warn(`[catalog] ${err.message}`);
  }
  return (showsCache = rows);
}

export async function getShow(slug) {
  return (await allShows()).find((s) => s.slug === slug) ?? null;
}

/** Episode slots [{show, episode, at}] for the schedule, soonest first. */
export async function airingSlots() {
  if (airingCache) return airingCache;
  const shows = await allShows();
  const byId = new Map(shows.map((s) => [s.id, s]));
  let rows = [];
  if (process.env.SAMPLE_DATA === '1') rows = (await import('./sample-catalog.js')).AIRING;
  else if (useDb()) rows = await query('SELECT media_id, episode, airing_at FROM airing ORDER BY airing_at LIMIT 3000').catch(() => []);
  airingCache = rows
    .map((r) => ({ show: byId.get(r.media_id), episode: r.episode, at: r.airing_at }))
    .filter((r) => r.show);
  return airingCache;
}

/* ---------- seasons ---------- */

export const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
export const seasonLabel = (s) => (s ? s[0] + s.slice(1).toLowerCase() : '');

export function seasonOf(date = new Date()) {
  return { season: SEASONS[Math.floor(date.getUTCMonth() / 3)], year: date.getUTCFullYear() };
}
export function shiftSeason({ season, year }, by) {
  let i = SEASONS.indexOf(season) + by;
  let y = year;
  while (i < 0) (i += 4), y--;
  while (i > 3) (i -= 4), y++;
  return { season: SEASONS[i], year: y };
}
export const seasonId = (s) => `${s.season.toLowerCase()}-${s.year}`;
export function parseSeasonId(id) {
  const m = /^(winter|spring|summer|fall)-(\d{4})$/.exec(id || '');
  return m ? { season: m[1].toUpperCase(), year: Number(m[2]) } : null;
}
/** Previous, current and next season: the window the bot keeps complete. */
export function seasonWindow(date = new Date()) {
  const cur = seasonOf(date);
  return [shiftSeason(cur, -1), cur, shiftSeason(cur, 1)];
}

export async function showsInSeason({ season, year }) {
  return (await allShows()).filter((s) => s.season === season && s.season_year === year);
}

/* ---------- labels ---------- */

const FORMAT = { TV: 'TV series', TV_SHORT: 'TV short', MOVIE: 'Film', SPECIAL: 'Special', OVA: 'OVA', ONA: 'Web series (ONA)', MUSIC: 'Music video' };
const STATUS = { RELEASING: 'Airing now', FINISHED: 'Finished', NOT_YET_RELEASED: 'Coming soon', CANCELLED: 'Cancelled', HIATUS: 'On hiatus' };
const SOURCE = {
  MANGA: 'manga', LIGHT_NOVEL: 'light novel', NOVEL: 'novel', WEB_NOVEL: 'web novel', ORIGINAL: 'original story', VIDEO_GAME: 'video game',
  VISUAL_NOVEL: 'visual novel', GAME: 'game', WEB_MANGA: 'web manga', MANHWA: 'manhwa (Korean comic)', MANHUA: 'manhua (Chinese comic)',
  COMIC: 'comic', OTHER: 'other source', LIVE_ACTION: 'live-action work', MULTIMEDIA_PROJECT: 'multimedia project', PICTURE_BOOK: 'picture book',
};
const COUNTRY = { JP: 'Japan', CN: 'China', KR: 'South Korea', TW: 'Taiwan' };
export const formatLabel = (f) => FORMAT[f] ?? (f ? f.replace(/_/g, ' ').toLowerCase() : '');
export const statusLabel = (s) => STATUS[s] ?? '';
export const sourceLabel = (s) => SOURCE[s] ?? '';
export const countryLabel = (c) => COUNTRY[c] ?? c ?? '';
export const isDonghua = (s) => s.country === 'CN';

export function airedLabel(s) {
  const f = (d) => (d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' }) : '');
  if (!s.start_date) return s.season ? `${seasonLabel(s.season)} ${s.season_year}` : 'To be announced';
  if (s.format === 'MOVIE' || s.start_date === s.end_date) return f(s.start_date);
  return `${f(s.start_date)} – ${s.end_date ? f(s.end_date) : s.status === 'RELEASING' ? 'now' : '?'}`;
}

/** A factual one-paragraph intro built only from catalog fields, used until our written overview exists. */
export function factLine(s) {
  const bits = [];
  const kind = formatLabel(s.format) || 'anime';
  const from = s.studios?.length ? ` from ${s.studios.join(' and ')}` : '';
  const based = sourceLabel(s.source) && s.source !== 'ORIGINAL' ? `, based on the ${sourceLabel(s.source)}` : s.source === 'ORIGINAL' ? ', an original story' : '';
  bits.push(`${s.title} is ${/^[aeiou]/i.test(kind) ? 'an' : 'a'} ${s.country === 'CN' ? 'Chinese ' : ''}${kind[0].toLowerCase() + kind.slice(1).replace('(ONA)', '(ONA)')}${from}${based}.`);
  if (s.genres?.length) bits.push(`It mixes ${listJoin(s.genres.slice(0, 4).map((g) => g.toLowerCase()))}.`);
  if (s.status === 'NOT_YET_RELEASED') bits.push(s.start_date ? `It is scheduled to premiere on ${airedLabel({ ...s, end_date: s.start_date, format: 'MOVIE' })}.` : 'A premiere date has not been announced yet.');
  else if (s.status === 'RELEASING') bits.push(`It is airing now${s.episodes ? ` and is planned for ${s.episodes} episodes` : ''}.`);
  else if (s.status === 'FINISHED' && s.episodes && s.format !== 'MOVIE') bits.push(`It ran for ${s.episodes} episode${s.episodes === 1 ? '' : 's'}.`);
  return bits.join(' ');
}
const listJoin = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a.at(-1)}`);

/* ---------- linking news to shows ---------- */

const norm = (t) => slugify(String(t || '').replace(/[’']/g, ''));
const baseKey = (t) =>
  norm(String(t || '').split(/[:：]| - | season \d| part \d|\(/i)[0])
    .replace(/-(season|part|cour)-?\d+$/, '')
    .replace(/-(\d+(st|nd|rd|th))?-?(season)?$/, '')
    .replace(/-+$/, '');

const rank = (s) => (s.status === 'RELEASING' ? 3 : s.status === 'NOT_YET_RELEASED' ? 2 : 1) * 1e9 + (s.popularity || 0);

/** name → show, using English/romaji titles, synonyms and the franchise name before any colon. */
async function aliases() {
  if (aliasCache) return aliasCache;
  const exact = new Map();
  const base = new Map();
  const put = (map, k, s) => {
    if (!k) return;
    const cur = map.get(k);
    if (!cur || rank(s) > rank(cur)) map.set(k, s);
  };
  for (const s of await allShows()) {
    for (const t of [s.title, s.title_romaji, ...(s.synonyms ?? [])]) {
      put(exact, norm(t), s);
      put(base, baseKey(t), s);
    }
  }
  return (aliasCache = { exact, base });
}

export async function showForName(name) {
  const { exact, base } = await aliases();
  return exact.get(norm(name)) ?? base.get(baseKey(name)) ?? null;
}

/** Link for an anime name used in a news story: its catalog page when we have one. */
export async function animeHref(name) {
  const s = await showForName(name);
  return `/anime/${s ? s.slug : slugify(name)}/`;
}

/** Other entries of the same franchise (seasons, films, spin-offs). */
export async function franchise(show, limit = 12) {
  const key = baseKey(show.title);
  const keyR = baseKey(show.title_romaji);
  return (await allShows())
    .filter((s) => s.id !== show.id && (baseKey(s.title) === key || (keyR && baseKey(s.title_romaji) === keyR)))
    .sort((a, b) => (a.start_date || '9999').localeCompare(b.start_date || '9999'))
    .slice(0, limit);
}

/** Similar shows: shared genres, weighted by popularity. */
export async function similar(show, limit = 6) {
  const g = new Set(show.genres ?? []);
  if (!g.size) return [];
  const fam = new Set((await franchise(show, 50)).map((s) => s.id));
  return (await allShows())
    .filter((s) => s.id !== show.id && !fam.has(s.id))
    .map((s) => ({ s, k: (s.genres ?? []).filter((x) => g.has(x)).length }))
    .filter((x) => x.k >= Math.min(2, g.size))
    .sort((a, b) => b.k - a.k || (b.s.popularity || 0) - (a.s.popularity || 0))
    .slice(0, limit)
    .map((x) => x.s);
}

/**
 * Every /anime/<slug>/ page: catalog shows plus news hubs that have no catalog entry.
 * Returns Map slug → { show, hub }. A hub that matches a show is merged into the show's page.
 */
let pagesCache;
export async function animePages() {
  if (pagesCache) return pagesCache;
  const pages = new Map();
  for (const s of await allShows()) pages.set(s.slug, { show: s, hub: null, canonical: s.slug });
  for (const h of await animeHubs()) {
    const s = pages.get(h.slug)?.show ?? (await showForName(h.name));
    if (s) {
      const page = pages.get(s.slug);
      page.hub = mergeHub(page.hub, h);
      // the news hub's own URL keeps working and points search engines to the show page
      if (h.slug !== s.slug) pages.set(h.slug, { show: s, hub: page.hub, canonical: s.slug, alias: true });
    } else {
      pages.set(h.slug, { show: null, hub: h, canonical: h.slug });
    }
  }
  return (pagesCache = pages);
}
function mergeHub(a, b) {
  if (!a) return b;
  const seen = new Set(a.articles.map((x) => x.id));
  const articles = [...a.articles, ...b.articles.filter((x) => !seen.has(x.id))].sort((x, y) => y.published_at.localeCompare(x.published_at));
  return { ...a, count: articles.length, views: a.views + b.views, articles, latest: articles[0]?.published_at };
}

/** Pages worth indexing: our own overview or our own news coverage. Others are noindex (still useful to visitors). */
export const indexable = (page) => Boolean(page && !page.alias && (page.show?.summary || page.hub?.articles?.length));

/* ---------- browse ---------- */

export const LETTERS = ['0-9', ...'abcdefghijklmnopqrstuvwxyz'];
export const letterOf = (title) => {
  const c = norm(title)[0] || '0';
  return /[a-z]/.test(c) ? c : '0-9';
};

/** Compact episode list for the client-side schedule. */
export async function scheduleData() {
  return (await airingSlots()).map(({ show: s, episode, at }) => ({
    t: at,
    e: episode,
    of: s.episodes || undefined,
    s: s.slug,
    n: s.title,
    c: s.cover_url || undefined,
    col: s.cover_color || undefined,
    k: s.country || undefined,
  }));
}
