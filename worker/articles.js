// Admin article editor API: write, edit and unpublish articles by hand, and upload pictures for them.
// Admin only. Saving a published article rebuilds the static site, so it goes live in a few minutes.
//   GET  /api/admin/articles            recent articles (to pick one to edit)
//   GET  /api/admin/articles/:id        one article, all fields
//   POST /api/admin/articles            create (JSON)
//   POST /api/admin/articles/:id        update (JSON)
//   POST /api/admin/articles/image      upload a picture (multipart "file") → { url }
import { json, fail, assertSameOrigin, audit, nowIso, clean } from './lib.js';
import { requireUser } from './auth.js';
import { storageReady, putFile, sniff } from './storage.js';

const CATEGORIES = new Set(['news', 'upcoming', 'release', 'feature']);
const MAX_IMAGE = 8 * 1024 * 1024;

const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
    .replace(/-+$/, '');

const plainExcerpt = (md) =>
  String(md)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !p.startsWith('#') && !/^https?:\/\/\S+$/.test(p) && !p.startsWith('!['))
    ?.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220) || '';

function parseSources(list) {
  const out = { urls: [], names: [] };
  for (const s of Array.isArray(list) ? list.slice(0, 10) : []) {
    const url = clean(s?.url, 500);
    if (!url) continue;
    let u;
    try { u = new URL(url); } catch { fail(400, `"${url}" is not a valid web link.`); }
    if (!/^https?:$/.test(u.protocol)) fail(400, 'Reference links must start with http:// or https://');
    out.urls.push(u.toString());
    out.names.push(clean(s?.name, 80) || u.hostname.replace(/^www\./, ''));
  }
  return out;
}

function articleOut(r) {
  const j = (v, d = []) => { try { return JSON.parse(v); } catch { return d; } };
  return {
    id: r.id, slug: r.slug, title: r.title, excerpt: r.excerpt, body: r.body_md, category: r.category,
    anime: j(r.anime), sources: j(r.source_urls).map((url, i) => ({ url, name: j(r.source_names)[i] || '' })),
    coverUrl: r.cover_url, coverCredit: r.cover_credit, releaseDate: r.release_date, status: r.status,
    publishedAt: r.published_at, updatedAt: r.updated_at, manual: String(r.cluster_key || '').startsWith('manual:'),
  };
}

async function listArticles(request, env) {
  await requireUser(request, env, 'admin');
  const q = new URL(request.url).searchParams.get('q')?.trim();
  const rows = q
    ? await env.DB.prepare("SELECT * FROM articles WHERE status != 'rejected' AND title LIKE ? ORDER BY COALESCE(published_at, created_at) DESC LIMIT 40").bind(`%${q}%`).all()
    : await env.DB.prepare("SELECT * FROM articles WHERE status != 'rejected' ORDER BY COALESCE(published_at, created_at) DESC LIMIT 40").all();
  return json({ articles: rows.results.map(articleOut) });
}

async function getArticle(request, env, id) {
  await requireUser(request, env, 'admin');
  const r = await env.DB.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first();
  if (!r) fail(404, 'Article not found.');
  return json({ article: articleOut(r) });
}

async function saveArticle(request, env, ctx, dispatchDeploy, id) {
  assertSameOrigin(request, env);
  const admin = await requireUser(request, env, 'admin');
  const b = await request.json().catch(() => ({}));
  const title = clean(b.title, 180);
  const body = clean(b.body, 60000);
  const category = CATEGORIES.has(b.category) ? b.category : 'news';
  const status = b.status === 'draft' ? 'draft' : b.status === 'rejected' ? 'rejected' : 'published';
  if (status !== 'rejected') {
    if (title.length < 10) fail(400, 'The headline needs at least 10 characters.');
    if (body.replace(/\s+/g, ' ').length < 150) fail(400, 'The article needs at least a few sentences (150+ characters).');
  }
  const slug = slugify(b.slug || title);
  if (slug.length < 3) fail(400, 'The web address needs at least 3 letters or numbers.');
  const clash = await env.DB.prepare('SELECT id FROM articles WHERE slug = ?').bind(slug).first();
  if (clash && clash.id !== id) fail(409, `anime.support/news/${slug}/ is already used by another article. Change the web address.`);
  const anime = (Array.isArray(b.anime) ? b.anime : String(b.anime || '').split(','))
    .map((s) => clean(s, 80))
    .filter(Boolean)
    .slice(0, 6);
  const src = parseSources(b.sources);
  const coverUrl = clean(b.coverUrl, 500) || null;
  if (coverUrl && !/^\/api\/media\/a\/[\w-]+\.(jpg|png|webp)$/.test(coverUrl) && !/^https:\/\//.test(coverUrl)) fail(400, 'Bad picture link.');
  // with a picture, a credit is always stored so the bot's cover tool never replaces it
  const coverCredit = coverUrl ? clean(b.coverCredit, 160) || 'anime.support' : null;
  const releaseDate = /^\d{4}-\d{2}-\d{2}$/.test(b.releaseDate || '') ? b.releaseDate : null;
  const excerpt = clean(b.excerpt, 300) || plainExcerpt(body);
  const now = nowIso();

  let row;
  if (id) {
    const old = await env.DB.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first();
    if (!old) fail(404, 'Article not found.');
    const publishedAt = status === 'published' ? old.published_at || now : old.published_at;
    row = await env.DB.prepare(
      `UPDATE articles SET slug = ?, title = ?, excerpt = ?, body_md = ?, category = ?, anime = ?, source_urls = ?, source_names = ?,
         cover_url = ?, cover_credit = ?, release_date = ?, status = ?, published_at = ?, updated_at = ? WHERE id = ? RETURNING *`,
    ).bind(slug, title || old.title, excerpt, body || old.body_md, category, JSON.stringify(anime), JSON.stringify(src.urls), JSON.stringify(src.names),
      coverUrl, coverCredit, releaseDate, status, publishedAt, now, id).first();
    await audit(env, admin.id, 'article.update', `article:${id}`, { status, slug });
  } else {
    row = await env.DB.prepare(
      `INSERT INTO articles (slug, title, excerpt, body_md, category, anime, source_urls, source_names, cluster_key, priority, status,
         published_at, updated_at, confidence, cover_url, cover_credit, release_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1, ?, ?, ?) RETURNING *`,
    ).bind(slug, title, excerpt, body, category, JSON.stringify(anime), JSON.stringify(src.urls), JSON.stringify(src.names), `manual:${slug}`,
      status, status === 'published' ? now : null, now, coverUrl, coverCredit, releaseDate).first();
    await audit(env, admin.id, 'article.create', `article:${row.id}`, { status, slug });
  }
  // published (or taken down): rebuild the static site so the change goes live
  let deploying = false;
  if (status !== 'draft' && dispatchDeploy) {
    deploying = Boolean(env.GH_DISPATCH_TOKEN);
    ctx.waitUntil(dispatchDeploy(env).catch((e) => console.log('deploy dispatch failed', e.message)));
  }
  return json({ article: articleOut(row), url: `/news/${row.slug}/`, deploying });
}

async function uploadImage(request, env) {
  assertSameOrigin(request, env);
  await requireUser(request, env, 'admin');
  if (!storageReady(env)) fail(503, 'Picture storage is not set up yet.');
  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') fail(400, 'Choose a picture.');
  if (file.size > MAX_IMAGE) fail(413, 'Pictures can be up to 8 MB.');
  const buf = new Uint8Array(await file.arrayBuffer());
  const t = sniff(buf);
  if (!t || !['image/jpeg', 'image/png', 'image/webp'].includes(t.type)) fail(415, 'Use a JPG, PNG or WebP picture.');
  const ext = t.type === 'image/jpeg' ? 'jpg' : t.type === 'image/png' ? 'png' : 'webp';
  const name = slugify(clean(form.get('name'), 60)) || 'image';
  const key = `a/${name}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;
  await putFile(env, key, buf, t.type);
  return json({ url: `/api/media/${key}` });
}

export async function handleArticles(request, env, ctx, path, dispatchDeploy) {
  const M = request.method;
  if (path === '/api/admin/articles/image' && M === 'POST') return uploadImage(request, env);
  if (path === '/api/admin/articles') {
    if (M === 'GET') return listArticles(request, env);
    if (M === 'POST') return saveArticle(request, env, ctx, dispatchDeploy, null);
  }
  const m = /^\/api\/admin\/articles\/(\d+)$/.exec(path);
  if (m) {
    if (M === 'GET') return getArticle(request, env, Number(m[1]));
    if (M === 'POST') return saveArticle(request, env, ctx, dispatchDeploy, Number(m[1]));
  }
  return null;
}
