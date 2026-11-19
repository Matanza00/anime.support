// Content audit (prints only, changes nothing): how much thin, duplicate or templated content the site has.
import { sql } from './d1.js';
import { log } from './log.js';

const words = (md) => String(md || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/https?:\/\/\S+/g, '').split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;

export async function audit() {
  const arts = await sql("SELECT id, slug, title, category, anime, body_md, published_at, cluster_key FROM articles WHERE status = 'published'");
  const wc = arts.map((a) => ({ ...a, w: words(a.body_md), show: (() => { try { return JSON.parse(a.anime)[0] || ''; } catch { return ''; } })() }));
  const guide = (a) => /-(watch-order|where-to-watch|beginners-guide|how-long-to-watch|whats-next)$/.test(a.slug);
  const news = wc.filter((a) => !guide(a));
  const band = (lo, hi) => news.filter((a) => a.w >= lo && a.w < hi).length;
  log(`AUDIT published articles: ${wc.length} (${news.length} news, ${wc.length - news.length} guides, ${wc.filter((a) => String(a.cluster_key).startsWith('manual:')).length} hand-written)`);
  log(`AUDIT news length: <200 words ${band(0, 200)} | 200-299 ${band(200, 300)} | 300-449 ${band(300, 450)} | 450-699 ${band(450, 700)} | 700+ ${band(700, 1e9)}`);
  const byDay = {};
  for (const a of news) byDay[(a.published_at || '').slice(0, 10)] = (byDay[(a.published_at || '').slice(0, 10)] || 0) + 1;
  log(`AUDIT news per day: ${Object.entries(byDay).sort().map(([d, n]) => `${d.slice(5)}:${n}`).join(' ')}`);
  const byCat = {};
  for (const a of news) byCat[a.category] = (byCat[a.category] || 0) + 1;
  log(`AUDIT by section: ${JSON.stringify(byCat)}`);
  const byShow = {};
  for (const a of news) if (a.show) (byShow[a.show.toLowerCase()] ||= []).push(a);
  const crowded = Object.values(byShow).filter((l) => l.length >= 3).sort((a, b) => b.length - a.length).slice(0, 12);
  for (const l of crowded) log(`AUDIT ${l.length} stories on "${l[0].show}": ${l.map((a) => `${a.w}w ${a.title.slice(0, 60)}`).join(' || ')}`);
  for (const a of news.filter((x) => x.w < 200).slice(0, 25)) log(`AUDIT short ${a.w}w /news/${a.slug}/`);
  const [c] = await sql(`SELECT COUNT(*) total, SUM(summary IS NOT NULL AND summary != '') with_summary, SUM(status = 'RELEASING') airing,
    SUM(status = 'NOT_YET_RELEASED') upcoming, SUM(status = 'FINISHED') finished FROM anime_catalog`);
  log(`AUDIT catalog: ${JSON.stringify(c)}`);
}
