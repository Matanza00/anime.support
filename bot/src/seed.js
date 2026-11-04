// One-off: publishes the evergreen launch articles in supabase/seed/articles.json,
// with original artwork for each. Safe to run twice (existing slugs are skipped).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, q } from './db.js';
import { createArtwork } from './artwork.js';
import { log } from './log.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export async function seed() {
  const file = path.resolve(here, '../../supabase/seed/articles.json');
  const items = JSON.parse(await fs.readFile(file, 'utf8'));
  const existing = new Set((await q(db().from('articles').select('slug'))).map((r) => r.slug));
  let added = 0;
  for (const [i, it] of items.entries()) {
    if (existing.has(it.slug)) continue;
    const art = await createArtwork({ slug: it.slug, title: it.title, anime: it.anime, category: it.category, imagePrompt: it.image_prompt });
    const when = new Date(Date.now() - (items.length - i) * 3600e3).toISOString();
    await q(
      db().from('articles').insert({
        ...it,
        ...art,
        status: 'published',
        published_at: when,
        created_at: when,
        fb_posted: true, // evergreen pieces: don't flood the Facebook page at launch
      }),
    );
    added++;
    log(`Published launch article: ${it.title}`);
  }
  log(`Seed done: ${added} new article(s)`);
  return added;
}
