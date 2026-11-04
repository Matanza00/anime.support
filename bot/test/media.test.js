import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { classifyUrl, parseMediaLines, mediaToLines, mediaFromPage } from '../src/media.js';

test('recognises embeddable URLs', () => {
  assert.deepEqual(classifyUrl('https://youtu.be/dQw4w9WgXcQ?t=3').type, 'youtube');
  assert.equal(classifyUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ').id, 'dQw4w9WgXcQ');
  assert.equal(classifyUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ').id, 'dQw4w9WgXcQ');
  assert.equal(classifyUrl('https://twitter.com/Crunchyroll/status/1234567890').url, 'https://x.com/Crunchyroll/status/1234567890');
  assert.equal(classifyUrl('https://www.instagram.com/reel/AbC_1/').type, 'instagram');
  assert.equal(classifyUrl('https://www.tiktok.com/@a/video/7123').type, 'tiktok');
  assert.equal(classifyUrl('https://cdn.site/clip.mp4').type, 'video');
  assert.equal(classifyUrl('https://cdn.site/visual.webp').type, 'image');
  assert.equal(classifyUrl('https://example.com/article'), null);
});

test('dashboard lines round-trip', () => {
  const { items, rejected } = parseMediaLines('https://youtu.be/dQw4w9WgXcQ | PV 2 | © Studio\nhttps://cdn.x/a.jpg |  | Credit only\nnot a url');
  assert.equal(items.length, 2);
  assert.deepEqual(rejected, ['not a url']);
  assert.equal(items[1].credit, 'Credit only');
  const again = parseMediaLines(mediaToLines(items)).items;
  assert.deepEqual(again, items);
});

test('finds trailers and posts embedded in a source page', () => {
  const $ = cheerio.load(`<meta property="og:image" content="/img/kv.jpg">
    <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>
    <blockquote class="twitter-tweet"><a href="https://twitter.com/anime/status/42">x</a></blockquote>
    <a href="https://example.com/other">nope</a>`);
  const r = mediaFromPage($, 'https://news.site/story');
  assert.equal(r.ogImage, 'https://news.site/img/kv.jpg');
  assert.deepEqual(r.embeds.map((e) => e.type), ['youtube', 'x']);
});
