// Evergreen guides for the biggest franchises: 5 per anime, rebuilt from fresh facts each run.
//   watch order · where to watch · beginner's guide · what's next · how long to watch
// Facts come from AniList (every season, film and special, studios, episode counts, official streaming
// links), Wikipedia's summary (background only, credited) and recent headlines from our news feeds.
// Lists and numbers are built in code, so they are exact; the AI only writes the prose around them.
// Each guide has a fixed URL (e.g. /news/one-piece-watch-order/), so a rerun updates it instead of duplicating.
import { CONFIG } from './config.js';
import { sql, one, insert, now } from './d1.js';
import { chatJSON } from './llm.js';
import { slugify } from './text.js';
import { coverFromOfficialMedia } from './official-media.js';
import { log, warn } from './log.js';

export const FRANCHISES = [
  { name: 'One Piece', id: 21, wiki: 'One_Piece' },
  { name: 'Naruto', id: 20, wiki: 'Naruto' },
  { name: 'Dragon Ball', id: 223, wiki: 'Dragon_Ball' },
  { name: 'Attack on Titan', id: 16498, wiki: 'Attack_on_Titan' },
  { name: 'Demon Slayer', id: 101922, wiki: 'Demon_Slayer:_Kimetsu_no_Yaiba' },
  { name: 'Jujutsu Kaisen', id: 113415, wiki: 'Jujutsu_Kaisen' },
  { name: 'My Hero Academia', id: 21459, wiki: 'My_Hero_Academia' },
  { name: 'Death Note', id: 1535, wiki: 'Death_Note' },
  { name: 'Code Geass', id: 1575, wiki: 'Code_Geass' },
  { name: 'Monster', id: 19, wiki: 'Monster_(manga)' },
  { name: 'One-Punch Man', id: 21087, wiki: 'One-Punch_Man' },
  { name: 'Spy x Family', id: 140960, wiki: 'Spy_×_Family' },
  { name: 'Gintama', id: 918, wiki: 'Gintama' },
  { name: 'Bleach', id: 269, wiki: 'Bleach_(manga)' },
  { name: 'Hunter x Hunter', id: 11061, wiki: 'Hunter_×_Hunter' },
];

/* ---------------- AniList: the whole franchise ---------------- */

const FIELDS = `id siteUrl type format status episodes duration popularity averageScore source(version: 3)
  title { english romaji native } startDate { year month day } season seasonYear
  studios(isMain: true) { nodes { name } } externalLinks { site url type language }
  trailer { id site } coverImage { extraLarge } bannerImage
  nextAiringEpisode { airingAt episode }
  relations { edges { relationType(version: 2) node { id type format } } }`;

let last = 0;
async function media(id, attempt = 0) {
  const wait = last + 2200 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const res = await fetch(process.env.ANILIST_URL || 'https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': CONFIG.userAgent },
    body: JSON.stringify({ query: `query ($id: Int) { Media(id: $id, type: ANIME) { ${FIELDS} } }`, variables: { id } }),
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 429 && attempt < 3) {
    await new Promise((r) => setTimeout(r, (Number(res.headers.get('retry-after')) || 60) * 1000));
    return media(id, attempt + 1);
  }
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data.Media;
}

const FOLLOW = new Set(['SEQUEL', 'PREQUEL']); // the main story line
const KEEP = new Set(['SEQUEL', 'PREQUEL', 'SIDE_STORY', 'SPIN_OFF', 'ALTERNATIVE', 'PARENT', 'SUMMARY', 'COMPILATION']);

/** Every anime entry of a franchise: walks sequels/prequels, and records films, side stories and spin-offs. */
async function franchise(rootId, cap = 40) {
  const seen = new Map();
  const queue = [{ id: rootId, main: true }];
  while (queue.length && seen.size < cap) {
    const { id, main } = queue.shift();
    if (seen.has(id)) continue;
    let m;
    try {
      m = await media(id);
    } catch (err) {
      warn(`AniList ${id}: ${err.message}`);
      continue;
    }
    if (!m || m.format === 'MUSIC') continue;
    m.main = main;
    seen.set(id, m);
    for (const e of m.relations?.edges ?? []) {
      if (e.node.type !== 'ANIME' || !KEEP.has(e.relationType) || seen.has(e.node.id)) continue;
      const follow = main && FOLLOW.has(e.relationType) && ['TV', 'TV_SHORT', 'ONA', 'MOVIE'].includes(e.node.format);
      // films and side entries are listed, but we only keep walking along the main line
      if (follow || queue.length + seen.size < cap) queue.push({ id: e.node.id, main: follow && main });
    }
  }
  return [...seen.values()];
}

/* ---------------- facts ---------------- */

const date = (d) => (d?.year ? `${d.year}-${String(d.month || 1).padStart(2, '0')}-${String(d.day || 1).padStart(2, '0')}` : null);
const nice = (d) =>
  d?.year ? new Date(Date.UTC(d.year, (d.month || 1) - 1, d.day || 1)).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', ...(d.month ? { month: 'short' } : {}), ...(d.day ? { day: 'numeric' } : {}) }) : 'TBA';
const FORMAT = { TV: 'TV series', TV_SHORT: 'TV short', MOVIE: 'Film', SPECIAL: 'Special', OVA: 'OVA', ONA: 'Web series' };
const STATUS = { RELEASING: 'Airing now', FINISHED: 'Finished', NOT_YET_RELEASED: 'Upcoming', CANCELLED: 'Cancelled', HIATUS: 'On hiatus' };
const titleOf = (m) => m.title?.english || m.title?.romaji;

function factsFor(entries) {
  const sorted = [...entries].sort((a, b) => (date(a.startDate) || '9999').localeCompare(date(b.startDate) || '9999'));
  const mainLine = sorted.filter((m) => m.main || ['TV', 'MOVIE', 'ONA'].includes(m.format));
  const minutes = (m) => (m.episodes && m.duration ? m.episodes * m.duration : 0);
  const watchable = sorted.filter((m) => m.status !== 'NOT_YET_RELEASED' && m.status !== 'CANCELLED');
  const series = watchable.filter((m) => ['TV', 'TV_SHORT', 'ONA'].includes(m.format));
  const films = watchable.filter((m) => m.format === 'MOVIE');
  const totals = {
    series_entries: series.length,
    films: films.length,
    episodes: series.reduce((s, m) => s + (m.episodes || 0), 0),
    hours_series: Math.round(series.reduce((s, m) => s + minutes(m), 0) / 60),
    hours_films: Math.round(films.reduce((s, m) => s + minutes(m), 0) / 60),
    hours_everything: Math.round(watchable.reduce((s, m) => s + minutes(m), 0) / 60),
    unknown_length: watchable.filter((m) => !minutes(m)).map(titleOf),
  };
  const streams = new Map();
  for (const m of sorted)
    for (const l of m.externalLinks ?? [])
      if (l.type === 'STREAMING' && /^https:\/\//.test(l.url)) {
        if (!streams.has(l.site)) streams.set(l.site, { site: l.site, url: l.url, entries: [] });
        streams.get(l.site).entries.push(titleOf(m));
      }
  const upcoming = sorted.filter((m) => m.status === 'NOT_YET_RELEASED' || m.status === 'RELEASING');
  return { sorted, mainLine, series, films, totals, streams: [...streams.values()], upcoming };
}

function row(m) {
  const eps = m.format === 'MOVIE' ? (m.duration ? `${m.duration} min` : '') : m.episodes ? `${m.episodes} eps` : m.status === 'RELEASING' ? 'ongoing' : '';
  return `| ${titleOf(m)} | ${FORMAT[m.format] || m.format || ''} | ${nice(m.startDate)} | ${eps} | ${STATUS[m.status] || ''} |`;
}
const TABLE_HEAD = '| Title | Type | First aired | Length | Status |\n| --- | --- | --- | --- | --- |';

const TABLES = {
  'watch-order': (f) =>
    `${TABLE_HEAD}\n${f.sorted.filter((m) => ['TV', 'TV_SHORT', 'ONA', 'MOVIE', 'OVA', 'SPECIAL'].includes(m.format)).map(row).join('\n')}`,
  'where-to-watch': (f) =>
    f.streams.length
      ? `| Service | What it lists |\n| --- | --- |\n${f.streams.map((s) => `| [${s.site}](${s.url}) | ${[...new Set(s.entries)].slice(0, 4).join(', ')}${s.entries.length > 4 ? ' and more' : ''} |`).join('\n')}`
      : '_No official streaming service is listed in the database right now._',
  'beginners-guide': (f) => `${TABLE_HEAD}\n${f.series.slice(0, 12).map(row).join('\n')}`,
  'whats-next': (f) => (f.upcoming.length ? `${TABLE_HEAD}\n${f.upcoming.map(row).join('\n')}` : '_No new season or film is officially scheduled right now._'),
  'how-long-to-watch': (f) =>
    `| What you watch | Episodes | Approx. time |\n| --- | --- | --- |\n| Every TV / web series | ${f.totals.episodes} | ${f.totals.hours_series} hours |\n| Every anime film | ${f.totals.films} films | ${f.totals.hours_films} hours |\n| Everything listed | | ${f.totals.hours_everything} hours |`,
};

const TYPES = {
  'watch-order': { category: 'feature', ask: 'a complete WATCH ORDER guide: explain the recommended order to watch the series, seasons and films, and which films/specials are optional side stories. Mention release order vs. story order only if clear from the facts.' },
  'where-to-watch': { category: 'feature', ask: 'a WHERE TO WATCH guide: which official, legal services carry it (from the facts only), subbed/dubbed notes only if the facts say so, and a reminder that availability depends on country.' },
  'beginners-guide': { category: 'feature', ask: "a BEGINNER'S GUIDE: what the story is about (premise only, no spoilers), who made it, why it is so popular, and where a newcomer should start." },
  'whats-next': { category: 'upcoming', ask: "a WHAT'S NEXT guide: the latest confirmed seasons, films or episodes that are airing or upcoming (from the facts and the recent headlines only). If nothing is scheduled, say so plainly and explain what is officially known." },
  'how-long-to-watch': { category: 'feature', ask: 'a HOW LONG TO WATCH guide: total episodes and hours (use the numbers in TOTALS exactly), what you can skip, and a realistic watching plan (e.g. at 3 episodes a day).' },
};

const SYSTEM = `You write evergreen anime guides for ${CONFIG.siteName}, in an energetic but trustworthy fan voice.
Rules:
- Use ONLY the FACTS, TOTALS, BACKGROUND and RECENT HEADLINES given. Never invent dates, episode counts, studios, cast, plot details or announcements.
- BACKGROUND is from Wikipedia: use it to understand the series, write entirely in your own words, never copy phrases.
- Put the literal line [[TABLE]] where the data table belongs (the site inserts an exact table there). Do not write your own table, and do not re-list every entry: the table is the complete list. Name only the entries you give advice about (where to start, what is skippable and why), and tell readers the full list is in the table.
- No filler intros or sign-offs (no "Happy watching!"). Every paragraph should help the reader decide something.
- Markdown with ## headings, no H1, no links, no images. 450–750 words. Short paragraphs.
- Hide major spoilers inside <details><summary>Spoiler: label</summary>text</details>.
- Headline: start with the anime name, 50–85 characters, specific, no clickbait, no ALL CAPS, include the year ${new Date().getUTCFullYear()} only if natural.
Return JSON: {"title": "...", "excerpt": "140-160 characters", "body_markdown": "...", "facebook_caption": "1-2 lines, at most 2 emoji"}`;

async function wikipedia(title) {
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
      headers: { 'User-Agent': CONFIG.userAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return { text: j.extract || '', url: j.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}` };
  } catch {
    return null;
  }
}

/** Official image choice per guide, so the five covers of one anime differ. */
function imageFor(type, f) {
  const pick = {
    'watch-order': f.mainLine[0],
    'where-to-watch': f.series.at(-1) || f.sorted.at(-1),
    'beginners-guide': f.sorted[0],
    'whats-next': f.upcoming.at(-1) || f.sorted.at(-1),
    'how-long-to-watch': f.series[Math.floor(f.series.length / 2)] || f.sorted[0],
  }[type];
  if (!pick) return [];
  const credit = `${titleOf(pick)}${pick.studios?.nodes?.[0]?.name ? ` © ${pick.studios.nodes[0].name}` : ''} · via AniList`;
  const out = [];
  const trailer = pick.trailer?.site === 'youtube' ? pick.trailer.id : null;
  if (type === 'whats-next' && trailer) out.push({ kind: 'youtube', url: `https://www.youtube.com/watch?v=${trailer}`, credit, from: 'trailer' });
  if (type === 'watch-order' || type === 'how-long-to-watch') pick.bannerImage && out.push({ kind: 'image', url: pick.bannerImage, credit, from: 'AniList banner' });
  pick.coverImage?.extraLarge && out.push({ kind: 'image', url: pick.coverImage.extraLarge, credit, from: 'AniList cover' });
  pick.bannerImage && out.push({ kind: 'image', url: pick.bannerImage, credit, from: 'AniList banner' });
  return out;
}

/* ---------------- the task ---------------- */

export async function guides({ only = process.env.GUIDES_ONLY || '' } = {}) {
  if (!CONFIG.llm.apiKey) throw new Error('LLM_API_KEY is missing');
  const list = FRANCHISES.filter((f) => !only || only.split(',').some((o) => slugify(o) === slugify(f.name)));
  let made = 0;
  let failed = 0;
  for (const fr of list) {
    const entries = await franchise(fr.id);
    if (!entries.length) {
      warn(`${fr.name}: no AniList data`);
      continue;
    }
    const f = factsFor(entries);
    log(`${fr.name}: ${entries.length} entries (${f.series.length} series, ${f.films.length} films, ${f.upcoming.length} upcoming)`);
    const wiki = await wikipedia(fr.wiki);
    const headlines = (
      await sql(
        `SELECT title, published_at FROM raw_items WHERE (title LIKE ? OR title LIKE ?) ORDER BY fetched_at DESC LIMIT 12`,
        [`%${fr.name}%`, `%${fr.name.replace(/-/g, ' ')}%`],
      ).catch(() => [])
    ).map((h) => `${(h.published_at || '').slice(0, 10)} ${h.title}`);

    const facts = f.sorted.map((m) => ({
      title: titleOf(m),
      romaji: m.title?.romaji,
      format: FORMAT[m.format] || m.format,
      status: STATUS[m.status] || m.status,
      first_aired: nice(m.startDate),
      episodes: m.episodes,
      minutes_per_episode: m.duration,
      studio: m.studios?.nodes?.[0]?.name,
      source: m.source,
      main_story: Boolean(m.main),
      next_episode: m.nextAiringEpisode ? { episode: m.nextAiringEpisode.episode, date: new Date(m.nextAiringEpisode.airingAt * 1000).toISOString().slice(0, 10) } : undefined,
    }));

    for (const [type, spec] of Object.entries(TYPES)) {
      const slug = `${slugify(fr.name)}-${type}`;
      const table = TABLES[type](f);
      try {
        const out = await chatJSON(
          SYSTEM,
          `ANIME: ${fr.name}\nWRITE: ${spec.ask}\n\nFACTS (AniList, every entry in release order)\n${JSON.stringify(facts)}\n\nTOTALS\n${JSON.stringify(f.totals)}\n\nOFFICIAL STREAMING SERVICES\n${JSON.stringify(f.streams.map((s) => s.site))}\n\nRECENT HEADLINES (our news feeds)\n${headlines.join('\n') || 'none'}\n\nBACKGROUND (Wikipedia, do not copy)\n${wiki?.text || 'none'}\n\nTHE TABLE THE SITE WILL INSERT\n${table}`,
          { temperature: 0.6 },
        );
        if (!out.title || !out.body_markdown) throw new Error('empty answer');
        let body = String(out.body_markdown);
        body = body.includes('[[TABLE]]') ? body.replace('[[TABLE]]', `\n${table}\n`) : `${body}\n\n## At a glance\n\n${table}\n`;
        body += `\n\n_Facts from AniList${wiki ? ' and Wikipedia' : ''}, checked ${new Date().toISOString().slice(0, 10)}. Streaming availability varies by country._\n`;

        const candidates = imageFor(type, f);
        const trailerEntry = f.upcoming.at(-1)?.trailer?.site === 'youtube' ? f.upcoming.at(-1) : f.sorted.find((m) => m.trailer?.site === 'youtube');
        const mediaItems =
          (type === 'whats-next' || type === 'beginners-guide') && trailerEntry
            ? [{ type: 'youtube', url: `https://www.youtube.com/watch?v=${trailerEntry.trailer.id}`, caption: `${titleOf(trailerEntry)}: official trailer`, credit: 'YouTube', from: 'anilist' }]
            : [];
        const art = await coverFromOfficialMedia({ slug, title: String(out.title), anime: [fr.name], category: spec.category, media: type === 'whats-next' ? mediaItems : [], image_candidates: candidates });

        const fields = {
          title: String(out.title).slice(0, 140),
          excerpt: String(out.excerpt || '').slice(0, 220),
          body_md: body,
          category: spec.category,
          anime: JSON.stringify([fr.name]),
          source_urls: JSON.stringify([`https://anilist.co/anime/${fr.id}`, ...(wiki ? [wiki.url] : [])]),
          source_names: JSON.stringify(['AniList', ...(wiki ? ['Wikipedia'] : [])]),
          media: JSON.stringify(mediaItems),
          cover_url: art?.cover_url ?? null,
          cover_credit: art?.cover_credit ?? null,
          social_card_url: art?.social_card_url ?? null,
          fb_caption: out.facebook_caption || null,
          confidence: 0.95,
          updated_at: now(),
        };
        const existing = await one('SELECT id FROM articles WHERE slug = ?', [slug]);
        if (existing) {
          const keys = Object.keys(fields);
          await sql(`UPDATE articles SET ${keys.map((k) => `${k} = ?`).join(', ')}, status = 'published' WHERE id = ?`, [...keys.map((k) => fields[k]), existing.id]);
          log(`Updated: ${fields.title}`);
        } else {
          await insert('articles', { ...fields, slug, status: 'published', published_at: now(), created_at: now(), priority: 1.5 });
          log(`Published: ${fields.title}`);
        }
        made++;
      } catch (err) {
        failed++;
        warn(`${fr.name} ${type} failed: ${err.message}`);
        if (/AI_UNAVAILABLE|401/i.test(err.message)) {
          log(`Guides: stopped, no AI available (credits empty and free models used up) (${made} done before that)`);
          await interleaveGuides();
          return made; // the ones already written still go live
        }
      }
    }
  }
  log(`Guides: ${made} published or updated${failed ? `, ${failed} failed` : ''}`);
  await interleaveGuides();
  return made;
}

/**
 * New guides are written anime by anime, so the 5 of one show would sit together at the top of the
 * site. This spreads today's new guides out: one of each anime in turn, mixed between the news.
 */
export async function interleaveGuides({ hours = 10 } = {}) {
  const types = Object.keys(TYPES);
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  const rows = (await sql("SELECT id, slug, anime FROM articles WHERE status = 'published' AND published_at > ? ORDER BY id", [since])).filter((r) =>
    types.some((t) => r.slug.endsWith(`-${t}`)),
  );
  if (rows.length < 2) return 0;
  // round-robin over anime, and each anime starts at a different guide type, so neighbours differ in both
  const byAnime = new Map();
  for (const r of rows) {
    if (!byAnime.has(r.anime)) byAnime.set(r.anime, []);
    byAnime.get(r.anime).push(r);
  }
  const groups = [...byAnime.values()];
  const order = [];
  for (let round = 0; order.length < rows.length; round++)
    for (let g = 0; g < groups.length; g++) {
      const list = groups[g];
      if (round < list.length) order.push(list[(round + g) % list.length]);
    }
  const end = Date.now() - 5 * 60e3;
  const start = end - hours * 3600e3;
  const step = (end - start) / order.length;
  for (const [i, r] of order.entries()) {
    // newest first on the site = last in this list; small jitter so times don't look machine-made
    const t = new Date(start + step * (i + 0.5) + Math.round((Math.random() - 0.5) * step * 0.6)).toISOString();
    await sql('UPDATE articles SET published_at = ? WHERE id = ?', [t, r.id]);
  }
  log(`Guides: ${order.length} new guides spread over the last ${hours} hours`);
  return order.length;
}
