// After a deploy: tells IndexNow search engines (Bing, Yahoo, DuckDuckGo via Bing, Yandex, Seznam, Naver)
// which pages are new or changed, so they're crawled in minutes instead of days.
// The key isn't secret: it's published at https://anime.support/<key>.txt to prove we own the site.
import fs from 'node:fs';

const KEY = 'e37da976b7611477c6430432932494bd';
const HOST = 'anime.support';
const HOURS = Number(process.env.INDEXNOW_HOURS || 6); // the bot deploys every 2 hours; overlap is harmless
const ALL = process.env.INDEXNOW_ALL === 'true';

const since = Date.now() - HOURS * 3600e3;
const urls = new Set();
for (const file of ['sitemap.xml', 'news-sitemap.xml']) {
  const path = new URL(`../out/${file}`, import.meta.url);
  if (!fs.existsSync(path)) continue;
  for (const [, block] of fs.readFileSync(path, 'utf8').matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
    const mod = block.match(/<(?:lastmod|news:publication_date)>([^<]+)</)?.[1];
    if (loc && (ALL || (mod && Date.parse(mod) >= since))) urls.add(loc.trim());
  }
}
const list = [...urls].slice(0, 10000);
if (!list.length) {
  console.log('IndexNow: nothing new to submit');
} else {
  const send = () =>
    fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: list }),
      signal: AbortSignal.timeout(30000),
    });
  try {
    let res = await send();
    // 403 = the key file couldn't be read yet (a fresh deploy takes a moment to reach every edge): wait and retry
    for (let i = 0; res.status === 403 && i < 2; i++) {
      await new Promise((r) => setTimeout(r, 60000));
      res = await send();
    }
    console.log(`IndexNow: submitted ${list.length} URLs → HTTP ${res.status}${res.ok ? ' (accepted)' : ` ${(await res.text()).slice(0, 200)}`}`);
  } catch (err) {
    console.log(`IndexNow: could not submit (${err.message}); the site is deployed anyway`);
  }
}
