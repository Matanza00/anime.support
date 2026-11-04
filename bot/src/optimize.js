// Step 5 (weekly): learn which anime readers actually want, and which sources are worth watching.
//  - anime_focus.weight goes up for shows that earn more views per article, down for the rest.
//    Drafting uses that weight to decide which stories get written first.
//  - Sources are ranked per tier (daily / weekly / monthly) by how many of their headlines became
//    published articles; optionally, everything outside the top 3 of each tier is switched off.
import { sql, parseRow, now } from './d1.js';
import { CONFIG } from './config.js';
import { log } from './log.js';

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export async function optimizeAnime() {
  const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const daily = (
    await sql('SELECT d.views, a.anime FROM article_views_daily d JOIN articles a ON a.id = d.article_id WHERE d.day >= ? LIMIT 10000', [since])
  ).map(parseRow);
  const recent = (
    await sql("SELECT anime FROM articles WHERE status = 'published' AND published_at >= ?", [new Date(Date.now() - 7 * 864e5).toISOString()])
  ).map(parseRow);

  const stats = new Map(); // name -> { views, articles }
  const bump = (name, k, n) => {
    if (!stats.has(name)) stats.set(name, { views: 0, articles: 0 });
    stats.get(name)[k] += n;
  };
  for (const row of daily) for (const name of row.anime ?? []) bump(name, 'views', row.views);
  for (const a of recent) for (const name of a.anime ?? []) bump(name, 'articles', 1);
  if (!stats.size) return log('Optimizer: not enough view data yet'), [];

  const perArticle = [...stats.values()].map((s) => s.views / Math.max(1, s.articles));
  const avg = perArticle.reduce((a, b) => a + b, 0) / perArticle.length || 1;

  const existing = new Map((await sql('SELECT name, pinned FROM anime_focus')).map((r) => [r.name, Boolean(r.pinned)]));
  const rows = [...stats.entries()].map(([name, s]) => {
    let weight = clamp(s.views / Math.max(1, s.articles) / avg, 0.3, 3);
    if (existing.get(name)) weight = Math.max(1, weight);
    return {
      name,
      weight: Number(weight.toFixed(2)),
      views_7d: s.views,
      articles_7d: s.articles,
      updated_at: now(),
    };
  });
  for (const r of rows) await upsertFocus(r);

  const top = [...rows].sort((a, b) => b.views_7d - a.views_7d).slice(0, 10);
  log('Top anime this week:');
  for (const r of top) log(`  ${r.name}: ${r.views_7d} views, ${r.articles_7d} articles, weight ${r.weight}`);
  return rows;
}

async function upsertFocus(r) {
  const cols = Object.keys(r);
  await sql(
    `INSERT INTO anime_focus (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
     ON CONFLICT(name) DO UPDATE SET ${cols.filter((c) => c !== 'name').map((c) => `${c} = excluded.${c}`).join(', ')}`,
    cols.map((c) => r[c]),
  );
}

export async function rankSources() {
  const sources = (await sql('SELECT * FROM sources')).map(parseRow);
  const score = (s) => (s.items_seen < 20 ? 0.5 : s.items_used / s.items_seen); // neutral until enough data
  const report = {};
  for (const tier of ['daily', 'weekly', 'monthly']) {
    const ranked = sources.filter((s) => s.tier === tier).sort((a, b) => score(b) - score(a));
    report[tier] = ranked.map((s) => ({ name: s.name, used: s.items_used, seen: s.items_seen, enabled: s.enabled }));
    log(`Top ${tier} sources: ${ranked.slice(0, 3).map((s) => s.name).join(', ') || '(none)'}`);

    if (CONFIG.autoPrune) {
      const keep = new Set(ranked.slice(0, 3).map((s) => s.id));
      for (const s of ranked) {
        const enabled = keep.has(s.id);
        if (s.enabled !== enabled) await sql('UPDATE sources SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, s.id]);
      }
    }
  }
  return report;
}

/**
 * Cold start: before you have view data, borrow AniList's "trending now" list so the bot
 * prioritises shows fans are already searching for. Never lowers a weight learned from your traffic.
 */
export async function seedFromAniListTrending() {
  const query = `query { Page(perPage: 30) { media(type: ANIME, sort: TRENDING_DESC) { title { english romaji } } } }`;
  let titles = [];
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': CONFIG.userAgent },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15000),
    });
    titles = ((await res.json())?.data?.Page?.media ?? []).map((m) => m.title.english || m.title.romaji).filter(Boolean);
  } catch (err) {
    log(`AniList trending unavailable: ${err.message}`);
    return [];
  }
  const existing = new Map((await sql('SELECT name, weight, views_7d FROM anime_focus')).map((r) => [r.name, r]));
  const rows = titles.map((name, i) => {
    const boost = Number((2 - i / titles.length).toFixed(2)); // #1 trending → 2.0, last → ~1.0
    const prev = existing.get(name);
    const weight = prev && prev.views_7d > 0 ? prev.weight : Math.max(prev?.weight ?? 1, boost);
    return { name, weight, updated_at: now() };
  });
  for (const r of rows) await upsertFocus(r);
  log(`Seeded ${rows.length} trending anime from AniList`);
  return rows;
}

export async function optimize() {
  await seedFromAniListTrending();
  await optimizeAnime();
  await rankSources();
}
