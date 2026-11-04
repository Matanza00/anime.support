// Publishes the evergreen launch articles in database/seed/articles.json.
// Uses the pre-made artwork in web/public/launch/ when present. Safe to run twice (existing slugs are skipped).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql, insert } from './d1.js';
import { createArtwork } from './artwork.js';
import { log } from './log.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const exists = (p) => fs.access(p).then(() => true, () => false);

export async function seed() {
  const items = JSON.parse(await fs.readFile(path.resolve(here, '../../database/seed/articles.json'), 'utf8'));
  const existing = new Set((await sql('SELECT slug FROM articles')).map((r) => r.slug));
  let added = 0;
  for (const [i, it] of items.entries()) {
    if (existing.has(it.slug)) continue;
    const launchArt = path.resolve(here, `../../web/public/launch/${it.slug}.webp`);
    const art = (await exists(launchArt))
      ? { cover_url: `/launch/${it.slug}.webp`, cover_credit: 'Illustration: anime.support' }
      : await createArtwork({ slug: it.slug, title: it.title, anime: it.anime, category: it.category, imagePrompt: it.image_prompt });
    const when = new Date(Date.now() - (items.length - i) * 3600e3).toISOString();
    await insert('articles', {
      ...it,
      ...art,
      status: 'published',
      published_at: when,
      created_at: when,
      updated_at: when,
      fb_posted: 1, // evergreen pieces: don't flood the Facebook page at launch
    });
    added++;
    log(`Published launch article: ${it.title}`);
  }
  log(`Seed done: ${added} new article(s)`);
  return added;
}
