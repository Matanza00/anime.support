// Image storage in the D1 "media" table. At each deploy the site build copies every file out to
// /media/<key> as a static asset, so serving images costs nothing and needs no storage service.
import sharp from 'sharp';
import { sql, one, now } from './d1.js';
import { CONFIG } from './config.js';

// D1 rows max out around 2 MB; base64 adds a third, so keep stored files under ~1.4 MB.
export const MAX_BYTES = 1_400_000;

/** Saves a file and returns its site path, e.g. "/media/articles/slug/hero-x.webp". */
export async function uploadBuffer(buffer, key, contentType) {
  let buf = buffer;
  let type = contentType;
  if (buf.length > MAX_BYTES && type.startsWith('image/')) {
    // Too big: shrink to a web-friendly WebP rather than refusing it.
    buf = await sharp(buf).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    type = 'image/webp';
    key = key.replace(/\.\w+$/, '.webp');
  }
  if (buf.length > MAX_BYTES) {
    throw new Error(`File is ${(buf.length / 1e6).toFixed(1)} MB; the limit is 1.4 MB. For videos, paste a YouTube link instead.`);
  }
  await sql('INSERT OR REPLACE INTO media (key, mime, data, bytes, created_at) VALUES (?, ?, ?, ?, ?)', [
    key,
    type,
    buf.toString('base64'),
    buf.length,
    now(),
  ]);
  return `/media/${key}`;
}

/** Reads a stored file back (for the dashboard preview and the Facebook card). */
export async function getMedia(key) {
  const row = await one('SELECT mime, data FROM media WHERE key = ?', [key]);
  return row ? { type: row.mime, buffer: Buffer.from(row.data, 'base64') } : null;
}

/** Fetches any image URL the bot knows: our own /media/... paths come from D1, others over HTTP. */
export async function fetchImage(url) {
  if (url?.startsWith('/media/')) return (await getMedia(url.slice('/media/'.length)))?.buffer ?? null;
  if (url?.startsWith('/')) url = CONFIG.siteUrl + url;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
}

/** Absolute URL for things posted elsewhere (Facebook needs a full URL). */
export const absolute = (url) => (url && url.startsWith('/') ? CONFIG.siteUrl + url : url);
