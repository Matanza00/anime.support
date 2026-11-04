// Runs before `next build`: copies every image stored in D1 (table "media") into public/media/,
// so Cloudflare serves them as ordinary static files (fast, free, cacheable).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { d1Configured, query } from '../lib/d1.js';

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/media');

if (!d1Configured() || process.env.SAMPLE_DATA === '1') {
  console.log('[media] D1 not configured or sample mode: skipping image export');
  process.exit(0);
}
const keys = (await query('SELECT key FROM media ORDER BY key')).map((r) => r.key);
let written = 0;
for (let i = 0; i < keys.length; i += 10) {
  const batch = keys.slice(i, i + 10);
  const rows = await query(`SELECT key, data FROM media WHERE key IN (${batch.map(() => '?').join(', ')})`, batch);
  for (const r of rows) {
    if (!/^[\w./-]+$/.test(r.key) || r.key.includes('..')) continue; // never write outside public/media
    const file = path.join(outDir, r.key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, Buffer.from(r.data, 'base64'));
    written++;
  }
}
console.log(`[media] exported ${written} file(s) to public/media`);
