// Step 1: read each enabled source's RSS feed and store new headlines in raw_items.
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { db, q } from './db.js';
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
  if (!href) throw new Error('no RSS feed found on homepage; set feed_url manually in Supabase');
  return new URL(href, homepage).toString();
}

export async function collect() {
  const sources = await q(db().from('sources').select('*').eq('enabled', true));
  const cutoff = Date.now() - CONFIG.maxItemAgeHours * 3600e3;
  let added = 0;

  for (const src of sources) {
    try {
      let feedUrl = src.feed_url;
      if (!feedUrl) {
        feedUrl = await discoverFeed(src.homepage);
        await q(db().from('sources').update({ feed_url: feedUrl }).eq('id', src.id));
        log(`Discovered feed for ${src.name}: ${feedUrl}`);
      }

      // Conditional request: the server answers 304 when nothing changed, saving bandwidth for both sides.
      const headers = { 'User-Agent': CONFIG.userAgent, Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8' };
      if (src.feed_etag) headers['If-None-Match'] = src.feed_etag;
      if (src.feed_last_modified) headers['If-Modified-Since'] = src.feed_last_modified;
      const res = await fetch(feedUrl, { headers, signal: AbortSignal.timeout(20000) });
      if (res.status === 304) {
        await q(db().from('sources').update({ last_ok_at: new Date().toISOString(), last_error: null }).eq('id', src.id));
        log(`${src.name}: unchanged`);
        continue;
      }
      if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
      const feed = await parser.parseString(await res.text());
      await q(
        db()
          .from('sources')
          .update({ feed_etag: res.headers.get('etag'), feed_last_modified: res.headers.get('last-modified') })
          .eq('id', src.id),
      );
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
        const inserted = await q(
          db().from('raw_items').upsert(rows, { onConflict: 'url', ignoreDuplicates: true }).select('id'),
        );
        added += inserted.length;
        await q(
          db()
            .from('sources')
            .update({ items_seen: src.items_seen + inserted.length, last_ok_at: new Date().toISOString(), last_error: null })
            .eq('id', src.id),
        );
        log(`${src.name}: ${inserted.length} new of ${rows.length} recent`);
      } else {
        await q(db().from('sources').update({ last_ok_at: new Date().toISOString(), last_error: null }).eq('id', src.id));
      }
    } catch (err) {
      warn(`${src.name}: ${err.message}`);
      await q(db().from('sources').update({ last_error: err.message.slice(0, 300) }).eq('id', src.id));
    }
  }
  log(`Collect done: ${added} new headlines`);
  return added;
}
