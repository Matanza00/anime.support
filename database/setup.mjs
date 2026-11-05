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
for (const s of statements) {
  try {
    await query(id, s);
  } catch (err) {
    if (/^ALTER TABLE/i.test(s) && /duplicate column/i.test(err.message)) continue; // already added
    throw err;
  }
}
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

// 4. Creator Studio: draft contests to start from (admins edit, set the prize and publish them)
const [{ results: [{ c }] }] = await query(id, 'SELECT COUNT(*) AS c FROM contests');
if (c === 0) {
  const seeds = JSON.parse(fs.readFileSync(path.join(here, 'seed/contests.json'), 'utf8'));
  for (const k of seeds) {
    await query(
      id,
      `INSERT OR IGNORE INTO contests (slug, title, category, theme, description, prize, prize_usd, allow_fan_art, submit_opens_at, submit_closes_at, vote_closes_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [k.slug, k.title, k.category, k.theme, k.description, k.prize, k.prize_usd, k.allow_fan_art ? 1 : 0, k.submit_opens_at, k.submit_closes_at, k.vote_closes_at],
    );
  }
  console.log(`Added ${seeds.length} draft contests`);
}

// 5. Upload storage for artwork: R2 bucket (10 GB free) if R2 is enabled on the account, else a KV namespace (1 GB free)
const wranglerPath = path.join(root, 'wrangler.jsonc');
let wrangler = fs.readFileSync(wranglerPath, 'utf8').replace(/"database_id": "[^"]*"/, `"database_id": "${id}"`);
const BUCKET = 'anime-support-uploads';
let storage = null;
if (process.env.UPLOAD_STORAGE !== 'kv') {
  try {
    const list = await cf('/r2/buckets');
    const has = (list.buckets || []).some((b) => b.name === BUCKET);
    if (!has) await cf('/r2/buckets', { method: 'POST', body: JSON.stringify({ name: BUCKET }) });
    storage = `"r2_buckets": [{ "binding": "UPLOADS", "bucket_name": "${BUCKET}" }],`;
    console.log(`Uploads: R2 bucket ${BUCKET}`);
  } catch (err) {
    console.log(`Uploads: R2 not available (${err.message.split('\n')[0]}); trying KV`);
  }
}
if (!storage) {
  try {
    const list = await cf('/storage/kv/namespaces?per_page=100');
    let ns = (list || []).find((n) => n.title === BUCKET);
    if (!ns) ns = await cf('/storage/kv/namespaces', { method: 'POST', body: JSON.stringify({ title: BUCKET }) });
    storage = `"kv_namespaces": [{ "binding": "UPLOADS_KV", "id": "${ns.id}" }],`;
    console.log(`Uploads: KV namespace ${BUCKET}`);
  } catch (err) {
    console.log(`Uploads: OFF (${err.message.split('\n')[0]}). Give the API token "Workers R2 Storage: Edit" or "Workers KV Storage: Edit".`);
  }
}
if (storage && !/"(r2_buckets|kv_namespaces)"/.test(wrangler)) wrangler = wrangler.replace(/(\n\s*)("triggers")/, `$1${storage}$1$2`);
fs.writeFileSync(wranglerPath, wrangler);
if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, `D1_DATABASE_ID=${id}\nCLOUDFLARE_ACCOUNT_ID=${ACCOUNT}\n`);
console.log('Done.');
