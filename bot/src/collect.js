// Step 1: read each enabled source's RSS feed and store new headlines in raw_items.
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { sql, now } from './d1.js';
import { CONFIG } from './config.js';
import { log, warn } from './log.js';
import { stripHtml } from './text.js';

const parser = new Parser({ timeout: 20000, headers: { 'User-Agent': CONFIG.userAgent } });

/** Finds a site's RSS/Atom feed from <link rel="alternate"> on its homepage. */
export async function discoverFeed(homepage) {
  const res = await fetch(homepage, { headers: { 'User-Agent': CONFIG.userAgent } });
  if (!res.ok) throw new Error(`homepage HTTP ${res.status}`);
  const $ = cheerio.load(await res.text());
  const href = $('link[rel="alternate"][type*="rss"], link[rel="alternate"][type*="atom"]').first().attr('href');
  if (!href) throw new Error('no RSS feed found on homepage; set feed_url for this source in the database');
  return new URL(href, homepage).toString();
}

/** Inserts headlines 15 at a time (6 values each; D1 allows 100 bound values per query). Duplicates are skipped. */
async function insertItems(rows) {
  let n = 0;
  for (let i = 0; i < rows.length; i += 15) {
    const chunk = rows.slice(i, i + 15);
    const values = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    const params = chunk.flatMap((r) => [r.source_id, r.url, r.title, r.summary, r.published_at, now()]);
    const ids = await sql(
      `INSERT INTO raw_items (source_id, url, title, summary, published_at, fetched_at) VALUES ${values} ON CONFLICT(url) DO NOTHING RETURNING id`,
      params,
    );
    n += ids.length;
  }
  return n;
}

export async function collect() {
  const sources = await sql('SELECT * FROM sources WHERE enabled = 1');
  const cutoff = Date.now() - CONFIG.maxItemAgeHours * 3600e3;
  let added = 0;

  for (const src of sources) {
    try {
      let feedUrl = src.feed_url;
      if (!feedUrl) {
        feedUrl = await discoverFeed(src.homepage);
        await sql('UPDATE sources SET feed_url = ? WHERE id = ?', [feedUrl, src.id]);
        log(`Discovered feed for ${src.name}: ${feedUrl}`);
      }

      // Conditional request: the server answers 304 when nothing changed, saving bandwidth for both sides.
      const headers = { 'User-Agent': CONFIG.userAgent, Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8' };
      if (src.feed_etag) headers['If-None-Match'] = src.feed_etag;
      if (src.feed_last_modified) headers['If-Modified-Since'] = src.feed_last_modified;
      const res = await fetch(feedUrl, { headers, signal: AbortSignal.timeout(20000) });
      if (res.status === 304) {
        await sql('UPDATE sources SET last_ok_at = ?, last_error = NULL WHERE id = ?', [now(), src.id]);
        log(`${src.name}: unchanged`);
        continue;
      }
      if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
      const feed = await parser.parseString(await res.text());
      await sql('UPDATE sources SET feed_etag = ?, feed_last_modified = ? WHERE id = ?', [
        res.headers.get('etag'),
        res.headers.get('last-modified'),
        src.id,
      ]);
      const rows = (feed.items ?? [])
        .map((it) => ({
          source_id: src.id,
          url: it.link,
          title: (it.title ?? '').trim(),
          summary: stripHtml(it.contentSnippet || it.content || it.summary || '').slice(0, 1500),
          published_at: it.isoDate || it.pubDate ? new Date(it.isoDate || it.pubDate).toISOString() : null,
        }))
        .filter((r) => r.url && r.title)
        .filter((r) => !r.published_at || new Date(r.published_at).getTime() >= cutoff);

      if (rows.length) {
        const inserted = await insertItems(rows);
        added += inserted;
        await sql('UPDATE sources SET items_seen = items_seen + ?, last_ok_at = ?, last_error = NULL WHERE id = ?', [inserted, now(), src.id]);
        log(`${src.name}: ${inserted} new of ${rows.length} recent`);
      } else {
        await sql('UPDATE sources SET last_ok_at = ?, last_error = NULL WHERE id = ?', [now(), src.id]);
      }
    } catch (err) {
      warn(`${src.name}: ${err.message}`);
      await sql('UPDATE sources SET last_error = ? WHERE id = ?', [err.message.slice(0, 300), src.id]).catch(() => {});
    }
  }
  log(`Collect done: ${added} new headlines`);
  return added;
}
