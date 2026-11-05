// Run before every deploy (no dependencies, Node 20+). Safe to repeat:
//   1. finds or creates the D1 database "anime-support"
//   2. applies database/schema.sql (CREATE ... IF NOT EXISTS, so existing data is kept)
//   3. publishes the launch articles if the database has no articles yet
//   4. writes the database id into wrangler.jsonc and $GITHUB_ENV (D1_DATABASE_ID)
// Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (token permissions: Workers Scripts Edit + D1 Edit).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const NAME = process.env.D1_DATABASE_NAME || 'anime-support';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim();
// Accept both the plain account ID and the "com.cloudflare.api.account.<id>" form from token pages.
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID?.trim().replace(/^com\.cloudflare\.api\.account\./, '');
if (!ACCOUNT || !TOKEN) {
  console.error('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN (add them as GitHub repository secrets).');
  process.exit(1);
}

async function cf(p, init = {}) {
  const res = await fetch(`${process.env.CF_API_BASE || 'https://api.cloudflare.com/client/v4'}/accounts/${ACCOUNT}${p}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const msg = json.errors?.map((e) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${res.status}`;
    if (res.status === 403 || /auth/i.test(msg)) {
      throw new Error(`${msg}\nThe Cloudflare API token needs "Account · D1 · Edit" (My Profile → API Tokens → Edit → Add more).`);
    }
    throw new Error(msg);
  }
  return json.result;
}
const query = (id, sql, params) => cf(`/d1/database/${id}/query`, { method: 'POST', body: JSON.stringify(params ? { sql, params } : { sql }) });

// 1. database
let db = (await cf(`/d1/database?name=${encodeURIComponent(NAME)}`)).find((d) => d.name === NAME);
if (!db) {
  console.log(`Creating D1 database "${NAME}"…`);
  db = await cf('/d1/database', { method: 'POST', body: JSON.stringify({ name: NAME }) });
}
const id = db.uuid;
console.log(`D1 database: ${NAME} (${id})`);

// After a successful deploy: remember which content the live site was built from (the bot compares against it)
if (process.argv.includes('--mark-built')) {
  const builtAt = process.env.BUILD_STARTED_AT || new Date().toISOString();
  await query(
    id,
    "INSERT INTO bot_state (key, value, updated_at) VALUES ('site', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [JSON.stringify({ builtAt }), new Date().toISOString()],
  );
  console.log(`Live site marked as built from content up to ${builtAt}`);
  process.exit(0);
}
if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, `BUILD_STARTED_AT=${new Date().toISOString()}\n`);

// 2. schema, one statement at a time
const schema = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8').replace(/--[^\n]*/g, '');
const statements = schema.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
for (const s of statements) await query(id, s);
console.log(`Schema applied (${statements.length} statements)`);

// 3. launch articles
const [{ results: [{ n }] }] = await query(id, 'SELECT COUNT(*) AS n FROM articles');
if (n === 0) {
  const items = JSON.parse(fs.readFileSync(path.join(here, 'seed/articles.json'), 'utf8'));
  for (const [i, it] of items.entries()) {
    const when = new Date(Date.now() - (items.length - i) * 3600e3).toISOString();
    await query(
      id,
      `INSERT OR IGNORE INTO articles (slug, title, excerpt, body_md, category, anime, cover_url, cover_credit, image_prompt, status, published_at, created_at, updated_at, fb_posted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, 1)`,
      [it.slug, it.title, it.excerpt, it.body_md, it.category, JSON.stringify(it.anime ?? []), `/launch/${it.slug}.webp`, 'Illustration: anime.support', it.image_prompt ?? null, when, when, when],
    );
  }
  console.log(`Published ${items.length} launch articles`);
} else {
  console.log(`${n} articles already in the database`);
}

// 4. hand the id to wrangler and later steps
const wranglerPath = path.join(root, 'wrangler.jsonc');
fs.writeFileSync(wranglerPath, fs.readFileSync(wranglerPath, 'utf8').replace(/"database_id": "[^"]*"/, `"database_id": "${id}"`));
if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, `D1_DATABASE_ID=${id}\nCLOUDFLARE_ACCOUNT_ID=${ACCOUNT}\n`);
console.log('Done.');
