// Daily "catalog" task: builds the anime database from AniList's public API (free for sites earning
// under $150/month; see https://docs.anilist.co/guide/terms-of-use). No scraping of other sites.
//   1. Shows: last / this / next season, everything airing or upcoming, the 500 most popular,
//      donghua (Chinese animation) and what is trending. Adult titles are excluded.
//   2. Episode air times for the next 8 days (weekly schedule page).
//   3. Original overviews written by the AI for the most important shows without one yet.
// Where-to-watch links come from AniList's list of official streaming links (Crunchyroll, Netflix, ...).
import { sql, now } from './d1.js';
import { CONFIG } from './config.js';
import { chatJSON, aiStatus } from './llm.js';
import { slugify } from './text.js';
import { log, warn } from './log.js';

const ENDPOINT = process.env.ANILIST_URL || 'https://graphql.anilist.co';

const MEDIA = `
  id siteUrl isAdult countryOfOrigin format status episodes duration source(version: 3)
  season seasonYear
  startDate { year month day } endDate { year month day }
  title { romaji english native } synonyms
  genres tags { name rank isMediaSpoiler isAdult }
  averageScore popularity trending
  studios(isMain: true) { nodes { name } }
  coverImage { extraLarge large color } bannerImage
  trailer { id site }
  externalLinks { site url type language }
  nextAiringEpisode { airingAt episode }
  description(asHtml: false)
`;

const PAGE_QUERY = `query ($page: Int, $perPage: Int, $season: MediaSeason, $seasonYear: Int, $status: MediaStatus,
  $sort: [MediaSort], $country: CountryCode, $startAfter: FuzzyDateInt) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(type: ANIME, isAdult: false, season: $season, seasonYear: $seasonYear, status: $status, sort: $sort,
          countryOfOrigin: $country, startDate_greater: $startAfter, genre_not_in: ["Hentai"]) { ${MEDIA} }
  }
}`;

const AIRING_QUERY = `query ($page: Int, $perPage: Int, $from: Int, $to: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
      airingAt episode media { ${MEDIA} }
    }
  }
}`;

/* ---------------- AniList client (rate-limited, retries) ---------------- */

let last = 0;
const GAP_MS = Number(process.env.ANILIST_GAP_MS || 2200); // ~27 requests/min, under AniList's 30/min
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function anilist(query, variables, attempt = 0) {
  const wait = last + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': CONFIG.userAgent },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30000),
  });
  if (res.status === 429 && attempt < 4) {
    const retry = Number(res.headers.get('retry-after') || 60);
    warn(`AniList rate limit; waiting ${retry}s`);
    await sleep(retry * 1000 + 500);
    return anilist(query, variables, attempt + 1);
  }
  const json = await res.json().catch(() => ({}));
  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join('; ');
    if (res.status >= 500 && attempt < 2) {
      await sleep(5000);
      return anilist(query, variables, attempt + 1);
    }
    throw new Error(`AniList: ${msg}`);
  }
  if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
  return json.data;
}

/** Pages through a media list. Shrinks the page size if AniList says the query is too complex. */
async function mediaList(vars, maxPages) {
  const out = [];
  let perPage = 50;
  for (let page = 1; page <= maxPages; page++) {
    let data;
    try {
      data = await anilist(PAGE_QUERY, { ...vars, page, perPage });
    } catch (err) {
      if (/complex/i.test(err.message) && perPage > 10) {
        perPage = Math.floor(perPage / 2);
        page--;
        continue;
      }
      throw err;
    }
    out.push(...(data.Page.media ?? []));
    if (!data.Page.pageInfo.hasNextPage) break;
  }
  return out;
}

/* ---------------- mapping ---------------- */

export function seasonOf(date = new Date()) {
  const m = date.getUTCMonth();
  const y = date.getUTCFullYear();
  const season = ['WINTER', 'WINTER', 'WINTER', 'SPRING', 'SPRING', 'SPRING', 'SUMMER', 'SUMMER', 'SUMMER', 'FALL', 'FALL', 'FALL'][m];
  return { season, year: y };
}

export function shiftSeason({ season, year }, by) {
  const order = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  let i = order.indexOf(season) + by;
  let y = year;
  while (i < 0) (i += 4), y--;
  while (i > 3) (i -= 4), y++;
  return { season: order[i], year: y };
}

const ymd = (d) => (d?.year ? `${d.year}-${String(d.month || 1).padStart(2, '0')}-${String(d.day || 1).padStart(2, '0')}` : null);

/** Legal streaming links only: AniList marks official streams with type STREAMING. */
const STREAM_HOSTS = /crunchyroll|netflix|hidive|hulu|amazon|primevideo|disney|bilibili|iqiyi|youtube|muse|ani-one|wetv|youku|tencent|max\.com|hbomax|funimation|adultswim|retrocrunch|tubi|mewatch|abema|unext|dmm|viki|aniplus|laftel|catchplay|vrv|aniverse|anime-digital|wakanim|plex|pluto|roku|apple/i;

export function mapMedia(m) {
  const title = (m.title?.english || m.title?.romaji || '').trim();
  const links = m.externalLinks ?? [];
  const streaming = links
    .filter((l) => l.type === 'STREAMING' && /^https:\/\//.test(l.url || '') && STREAM_HOSTS.test(l.url))
    .map((l) => ({ site: l.site, url: l.url, language: l.language || null }));
  const official = links.find((l) => /official site/i.test(l.site || '') && /^https?:\/\//.test(l.url || ''))?.url ?? null;
  return {
    id: m.id,
    title,
    title_romaji: m.title?.romaji ?? null,
    title_native: m.title?.native ?? null,
    synonyms: (m.synonyms ?? []).filter((s) => s && s.length < 120).slice(0, 8),
    format: m.format ?? null,
    status: m.status ?? null,
    episodes: m.episodes ?? null,
    duration: m.duration ?? null,
    source: m.source ?? null,
    season: m.season ?? null,
    season_year: m.seasonYear ?? null,
    start_date: ymd(m.startDate),
    start_precision: m.startDate?.day ? 'day' : m.startDate?.month ? 'month' : m.startDate?.year ? 'year' : null,
    official_x: links.find((l) => /^(twitter|x)$/i.test(l.site || '') && /^https:\/\//.test(l.url || ''))?.url ?? null,
    end_date: ymd(m.endDate),
    country: m.countryOfOrigin ?? null,
    genres: (m.genres ?? []).filter((g) => g !== 'Hentai' && g !== 'Ecchi'),
    tags: (m.tags ?? []).filter((t) => !t.isMediaSpoiler && !t.isAdult && t.rank >= 60).slice(0, 8).map((t) => t.name),
    studios: (m.studios?.nodes ?? []).map((s) => s.name).slice(0, 3),
    score: m.averageScore ?? null,
    popularity: m.popularity ?? 0,
    trending: m.trending ?? 0,
    cover_url: m.coverImage?.extraLarge || m.coverImage?.large || null,
    cover_color: m.coverImage?.color ?? null,
    banner_url: m.bannerImage ?? null,
    trailer_youtube: m.trailer?.site === 'youtube' ? m.trailer.id : null,
    streaming,
    official_site: official,
    next_episode: m.nextAiringEpisode?.episode ?? null,
    next_airing_at: m.nextAiringEpisode?.airingAt ?? null,
    anilist_url: m.siteUrl ?? null,
    synopsis_src: m.description ? String(m.description).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2500) : null,
  };
}

const keep = (m) => m && !m.isAdult && (m.title?.english || m.title?.romaji) && !(m.genres ?? []).includes('Hentai');

/* ---------------- database writes ---------------- */

const COLS = [
  'id', 'slug', 'title', 'title_romaji', 'title_native', 'synonyms', 'format', 'status', 'episodes', 'duration', 'source',
  'season', 'season_year', 'start_date', 'start_precision', 'official_x', 'end_date', 'country', 'genres', 'tags', 'studios', 'score', 'popularity', 'trending',
  'cover_url', 'cover_color', 'banner_url', 'trailer_youtube', 'streaming', 'official_site', 'next_episode', 'next_airing_at',
  'anilist_url', 'synopsis_src', 'updated_at',
];
const JSON_FIELDS = new Set(['synonyms', 'genres', 'tags', 'studios', 'streaming']);

/**
 * Upserts many shows in one statement: the rows travel as ONE JSON parameter and SQLite's json_each
 * unpacks them (D1 allows only 100 bound values per query). Our own summary is never overwritten.
 */
async function upsertShows(rows) {
  for (let i = 0; i < rows.length; i += 40) {
    const chunk = rows.slice(i, i + 40).map((r) => {
      const o = {};
      for (const c of COLS) o[c] = JSON_FIELDS.has(c) ? JSON.stringify(r[c] ?? []) : (r[c] ?? null);
      return o;
    });
    const select = COLS.map((c) => `json_extract(value, '$.${c}')`).join(', ');
    const update = COLS.filter((c) => c !== 'id' && c !== 'slug').map((c) => `${c} = excluded.${c}`).join(', ');
    await sql(
      `INSERT INTO anime_catalog (${COLS.join(', ')}) SELECT ${select} FROM json_each(?) WHERE true
       ON CONFLICT(id) DO UPDATE SET ${update}`,
      [JSON.stringify(chunk)],
    );
  }
}

/** Stable, unique slugs: keep a show's existing slug; new ones get the title slug, or title-id on a clash. */
function assignSlugs(rows, existing) {
  const byId = new Map(existing.map((e) => [e.id, e.slug]));
  const taken = new Map(existing.map((e) => [e.slug, e.id]));
  for (const r of rows) {
    if (byId.has(r.id)) {
      r.slug = byId.get(r.id);
      continue;
    }
    let s = slugify(r.title) || `anime-${r.id}`;
    if (taken.has(s) && taken.get(s) !== r.id) s = `${s}-${r.id}`;
    taken.set(s, r.id);
    r.slug = s;
  }
}

/* ---------------- summaries ---------------- */

const SUMMARY_SYSTEM = `You write short, original overviews for an anime database page on ${CONFIG.siteName}.
Rules:
- 90 to 150 words, two short paragraphs, plain text (no markdown, no headings).
- Use the FACTS and the BACKGROUND SYNOPSIS only to understand the show. Write entirely in your own words;
  never copy a phrase from the synopsis.
- Describe the premise, tone and who will enjoy it. No spoilers beyond the opening premise.
- Never invent facts (dates, cast, studios, episode counts) that are not in FACTS.
Return JSON: {"summary": "..."}`;

async function writeSummaries(limit) {
  if (!CONFIG.llm.apiKey || limit <= 0) return 0;
  const rows = await sql(
    `SELECT id, title, title_native, format, status, episodes, season, season_year, source, country, genres, studios, synopsis_src
       FROM anime_catalog
      WHERE summary IS NULL AND synopsis_src IS NOT NULL AND length(synopsis_src) > 120
      ORDER BY CASE status WHEN 'RELEASING' THEN 0 WHEN 'NOT_YET_RELEASED' THEN 1 ELSE 2 END, popularity DESC
      LIMIT ?`,
    [limit],
  );
  let n = 0;
  for (const r of rows) {
    if (aiStatus().usedFallback && n >= 5) break; // on the free models, keep the daily quota for news
    const facts = {
      title: r.title,
      native_title: r.title_native,
      format: r.format,
      status: r.status,
      episodes: r.episodes,
      season: r.season && r.season_year ? `${r.season} ${r.season_year}` : null,
      source_material: r.source,
      country: r.country,
      genres: JSON.parse(r.genres || '[]'),
      studios: JSON.parse(r.studios || '[]'),
    };
    try {
      const out = await chatJSON(SUMMARY_SYSTEM, `FACTS\n${JSON.stringify(facts)}\n\nBACKGROUND SYNOPSIS (do not copy)\n${r.synopsis_src}`, { temperature: 0.7 });
      const summary = String(out.summary || '').trim();
      if (summary.split(/\s+/).length < 60) continue;
      await sql('UPDATE anime_catalog SET summary = ?, summary_at = ? WHERE id = ?', [summary, now(), r.id]);
      n++;
    } catch (err) {
      warn(`Summary failed for ${r.title}: ${err.message}`);
      if (/AI_UNAVAILABLE|401/i.test(err.message)) break;
    }
  }
  return n;
}

/* ---------------- the task ---------------- */

export async function catalog() {
  const cur = seasonOf();
  const seasons = [shiftSeason(cur, -1), cur, shiftSeason(cur, 1)];
  const lists = [
    ...seasons.map((s) => ({ label: `${s.season} ${s.year}`, vars: { season: s.season, seasonYear: s.year, sort: ['POPULARITY_DESC'] }, pages: 8 })),
    { label: 'airing now', vars: { status: 'RELEASING', sort: ['POPULARITY_DESC'] }, pages: 8 },
    { label: 'upcoming', vars: { status: 'NOT_YET_RELEASED', sort: ['POPULARITY_DESC'] }, pages: 8 },
    // everything with an announced premiere date from today on, soonest first (feeds the release calendar)
    { label: 'dated premieres', vars: { status: 'NOT_YET_RELEASED', startAfter: Number(new Date().toISOString().slice(0, 10).replace(/-/g, '')) - 1, sort: ['START_DATE'] }, pages: 6 },
    { label: 'trending', vars: { sort: ['TRENDING_DESC'] }, pages: 2 },
    { label: 'most popular', vars: { sort: ['POPULARITY_DESC'] }, pages: Number(process.env.CATALOG_POPULAR_PAGES || 10) },
    { label: 'donghua', vars: { country: 'CN', sort: ['POPULARITY_DESC'] }, pages: 6 },
    { label: 'donghua airing', vars: { country: 'CN', status: 'RELEASING', sort: ['POPULARITY_DESC'] }, pages: 3 },
  ];

  const shows = new Map();
  for (const l of lists) {
    try {
      const media = (await mediaList(l.vars, l.pages)).filter(keep);
      for (const m of media) shows.set(m.id, m);
      log(`AniList ${l.label}: ${media.length} shows`);
    } catch (err) {
      warn(`AniList ${l.label} failed: ${err.message}`);
    }
  }

  // Air times for the next 8 days (and the last day, so "just aired" still shows)
  const from = Math.floor(Date.now() / 1000) - 86400;
  const to = from + 9 * 86400;
  const slots = [];
  for (let page = 1; page <= 20; page++) {
    let data;
    try {
      data = await anilist(AIRING_QUERY, { page, perPage: 50, from, to });
    } catch (err) {
      warn(`AniList schedule failed: ${err.message}`);
      break;
    }
    for (const a of data.Page.airingSchedules ?? []) {
      if (!keep(a.media)) continue;
      shows.set(a.media.id, shows.get(a.media.id) ?? a.media);
      slots.push({ media_id: a.media.id, episode: a.episode, airing_at: a.airingAt });
    }
    if (!data.Page.pageInfo.hasNextPage) break;
  }
  log(`AniList schedule: ${slots.length} episodes in the next 8 days`);

  if (!shows.size) throw new Error('AniList returned no shows; nothing updated');

  const rows = [...shows.values()].map(mapMedia).map((r) => ({ ...r, updated_at: now() }));
  assignSlugs(rows, await sql('SELECT id, slug FROM anime_catalog'));
  await upsertShows(rows);
  log(`Catalog: ${rows.length} shows saved`);

  // Replace the schedule window
  await sql('DELETE FROM airing WHERE airing_at < ? OR airing_at >= ?', [from - 86400, from]);
  for (let i = 0; i < slots.length; i += 300) {
    await sql(
      `INSERT INTO airing (media_id, episode, airing_at)
       SELECT json_extract(value, '$.media_id'), json_extract(value, '$.episode'), json_extract(value, '$.airing_at') FROM json_each(?) WHERE true
       ON CONFLICT(media_id, episode) DO UPDATE SET airing_at = excluded.airing_at`,
      [JSON.stringify(slots.slice(i, i + 300))],
    );
  }

  const written = await writeSummaries(Number(process.env.CATALOG_SUMMARIES_PER_RUN || 60));
  log(`Catalog: ${written} new overviews written`);
  return { shows: rows.length, episodes: slots.length, summaries: written };
}
