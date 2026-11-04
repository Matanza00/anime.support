// Step 3: your review dashboard. Open http://localhost:4000 on the laptop, or
// http://<laptop-ip>:4000 from your phone on the same Wi-Fi. Edit, approve or reject drafts.
import express from 'express';
import multer from 'multer';
import { classifyUrl, parseMediaLines, mediaToLines } from './media.js';
import { uploadBuffer, getMedia } from './storage.js';
import { createArtwork, refreshSocialCard } from './artwork.js';
import { marked } from 'marked';
import { pathToFileURL } from 'node:url';
import { sql, one, parseRow, setClause, now } from './d1.js';
import { CONFIG } from './config.js';
import { publish } from './publish.js';
import { log, fail } from './log.js';

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ago = (iso) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Review</title>
<style>
:root{--bg:#110d22;--s:#15151f;--l:#2a2a3b;--t:#ecebf3;--m:#a3a1b5;--a:#ff5a72;--ok:#3ddc97;--warn:#ffb84d}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--t);font:16px/1.55 system-ui,sans-serif}
a{color:inherit}.w{max-width:860px;margin:0 auto;padding:16px}
header{display:flex;gap:14px;align-items:center;flex-wrap:wrap;border-bottom:1px solid var(--l);padding-bottom:12px;margin-bottom:16px}
header b{font-size:20px}header b span{color:var(--a)}header nav{display:flex;gap:14px;margin-left:auto;color:var(--m)}
.card{display:block;background:var(--s);border:1px solid var(--l);border-radius:12px;padding:14px 16px;margin-bottom:12px;text-decoration:none}
.card h3{margin:4px 0 6px;font-size:18px}.meta{color:var(--m);font-size:13px;display:flex;gap:10px;flex-wrap:wrap}
.pill{font-size:12px;padding:2px 8px;border-radius:99px;border:1px solid var(--l)}.low{color:var(--warn);border-color:var(--warn)}
label{display:block;font-size:13px;color:var(--m);margin:14px 0 4px}
input,textarea,select{width:100%;background:var(--s);color:var(--t);border:1px solid var(--l);border-radius:10px;padding:10px;font:inherit}
textarea{min-height:120px}textarea.body{min-height:360px;font:14px/1.5 ui-monospace,monospace}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0;position:sticky;bottom:0;background:var(--bg);padding:10px 0}
button{flex:1;min-width:120px;padding:12px;border-radius:10px;border:1px solid var(--l);background:var(--s);color:var(--t);font:600 15px system-ui;cursor:pointer}
button.go{background:var(--ok);color:#06140d;border-color:var(--ok)}button.no{color:#ff6b6b}
.preview{background:var(--s);border:1px solid var(--l);border-radius:12px;padding:4px 18px;margin-top:18px}
.flash{background:#13261d;border:1px solid var(--ok);border-radius:10px;padding:10px 14px;margin-bottom:14px}
fieldset{border:1px solid var(--l);border-radius:12px;padding:6px 14px 14px;margin:18px 0 0}legend{color:var(--a);font-weight:600;padding:0 6px}
.cover-prev{width:100%;max-height:220px;object-fit:cover;border-radius:10px;margin-top:6px}
.cands{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:6px}
.cand{display:flex;flex-direction:column;gap:6px;padding:6px;min-width:0;text-align:left;font:13px system-ui;color:var(--m);background:var(--bg);border:1px solid var(--l);border-radius:10px}
.cand img,.cand .ph{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:6px;background:var(--s)}
code{background:var(--bg);padding:1px 5px;border-radius:4px}
.err{color:#ff6b6b}table{width:100%;border-collapse:collapse;font-size:14px}td,th{border-bottom:1px solid var(--l);padding:8px;text-align:left}
</style></head><body><div class="w">
<header><b>anime<span>.support</span> review</b><nav><a href="/">Drafts</a><a href="/published">Published</a><a href="/sources">Sources</a></nav></header>
${body}</div></body></html>`;

export function createApp() {
  const app = express();
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // Password protection (username can be anything)
  app.use((req, res, next) => {
    if (!CONFIG.review.password) return next();
    const [, b64 = ''] = (req.headers.authorization || '').split(' ');
    const pass = Buffer.from(b64, 'base64').toString().split(':').slice(1).join(':');
    if (pass === CONFIG.review.password) return next();
    res.set('WWW-Authenticate', 'Basic realm="anime.support review"').status(401).send('Password required');
  });

  // Images saved by the bot live in D1 until the next deploy publishes them; show them here.
  app.get('/media/*key', async (req, res) => {
    const key = [].concat(req.params.key).join('/');
    const m = await getMedia(key);
    if (!m) return res.status(404).end();
    res.set('Content-Type', m.type).set('Cache-Control', 'public, max-age=86400').send(m.buffer);
  });

  app.get('/', async (req, res) => {
    const drafts = (
      await sql(
        `SELECT id, title, excerpt, category, anime, priority, confidence, created_at, source_names
           FROM articles WHERE status = 'draft' ORDER BY priority DESC, created_at DESC LIMIT 100`,
      )
    ).map(parseRow);
    const flash = req.query.msg ? `<div class="flash">${esc(req.query.msg)}</div>` : '';
    const list = drafts.length
      ? drafts
          .map(
            (d) => `<a class="card" href="/a/${d.id}">
          <div class="meta"><span class="pill">${esc(d.category)}</span><span>${esc((d.anime || []).join(', '))}</span>
          ${d.confidence != null && d.confidence < 0.7 ? '<span class="pill low">check facts</span>' : ''}<span>${ago(d.created_at)}</span></div>
          <h3>${esc(d.title)}</h3><div class="meta">${esc(d.excerpt)}</div>
          <div class="meta" style="margin-top:6px">via ${esc((d.source_names || []).join(', '))} · priority ${d.priority}</div></a>`,
          )
          .join('')
      : '<p class="meta">No drafts waiting. New ones arrive after each hourly run.</p>';
    res.send(
      page(
        'Drafts',
        `${flash}<form method="post" action="/deploy" style="margin-bottom:14px"><button>Deploy approved articles now</button></form>
         <h2 style="margin:0 0 12px">${drafts.length} draft(s) waiting</h2>${list}`,
      ),
    );
  });

  app.get('/a/:id', async (req, res) => {
    const a = parseRow(await one('SELECT * FROM articles WHERE id = ?', [Number(req.params.id)]));
    if (!a) return res.status(404).send(page('Not found', '<p>Article not found.</p>'));
    const sources = (a.source_urls || [])
      .map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(a.source_names?.[i] || u)}</a>`)
      .join(' · ');
    const lowConf =
      a.confidence != null && a.confidence < 0.7
        ? `<p class="err">The AI rated its own accuracy ${a.confidence}. Compare every fact with the sources before approving.</p>`
        : '';
    const cats = ['news', 'upcoming', 'release', 'feature']
      .map((c) => `<option ${c === a.category ? 'selected' : ''}>${c}</option>`)
      .join('');
    const media = a.media || [];
    const customHtml = media.find((m) => m.type === 'html')?.html || '';
    const candidates = (a.image_candidates || [])
      .map((c) => {
        const thumb = c.kind === 'youtube' ? ytThumb(c.url) : c.url;
        const act =
          c.kind === 'image'
            ? `onclick="pickCover(${esc(JSON.stringify(c.url))}, ${esc(JSON.stringify(c.credit || ''))})"`
            : `onclick="addMedia(${esc(JSON.stringify(c.url + (c.credit ? ' |  | ' + c.credit : '')))})"`;
        return `<button type="button" class="cand" ${act}><img src="${esc(thumb)}" alt="" loading="lazy">
          <span>${c.kind === 'image' ? 'Use as cover' : 'Add video'} · ${esc(c.from || '')}</span></button>`;
      })
      .join('');
    res.send(
      page(
        a.title,
        `${req.query.msg ? `<div class="flash">${esc(req.query.msg)}</div>` : ''}
        <div class="meta">Status: ${esc(a.status)} · Sources: ${sources}</div>${lowConf}
      <form method="post" action="/a/${a.id}" enctype="multipart/form-data">
        <label>Headline (${a.title.length} chars)</label><input name="title" value="${esc(a.title)}" maxlength="140">
        <label>Excerpt / meta description</label><textarea name="excerpt" style="min-height:70px">${esc(a.excerpt)}</textarea>
        <label>Category</label><select name="category">${cats}</select>
        <label>Anime (comma separated)</label><input name="anime" value="${esc((a.anime || []).join(', '))}">
        <label>Confirmed release date (only if official; shows in the calendar and countdowns)</label>
        <input type="date" name="release_date" value="${esc(a.release_date || '')}">

        <fieldset><legend>Cover image</legend>
          ${a.cover_url ? `<img class="cover-prev" id="coverPrev" src="${esc(a.cover_url)}" alt="">` : '<img class="cover-prev" id="coverPrev" alt="" hidden>'}
          <label>Image URL</label><input id="cover_url" name="cover_url" value="${esc(a.cover_url || '')}" placeholder="https://…">
          <label>Credit (shown on the image)</label><input id="cover_credit" name="cover_credit" value="${esc(a.cover_credit || '')}" placeholder="Key visual © Studio">
          <label>…or upload your own</label><input type="file" name="upload_cover" accept="image/*">
          ${candidates ? `<label>Found by the bot (tap to use)</label><div class="cands">${candidates}</div>` : ''}
          <label>Artwork scene (used to create a new original image)</label>
          <textarea name="image_prompt" style="min-height:60px">${esc(a.image_prompt || '')}</textarea>
          <button name="action" value="regen" style="margin-top:8px">Create new artwork</button>
          ${a.social_card_url ? `<label>Facebook card (rebuilt from the headline when you approve)</label><img class="cover-prev" src="${esc(a.social_card_url)}" alt="">` : ''}
        </fieldset>

        <fieldset><legend>Media in the article</legend>
          <p class="meta">One per line: <code>URL | caption | credit</code>. Works with YouTube, X, Instagram, TikTok, .mp4/.webm videos and image links.
          You can also paste any of these URLs on its own line inside the article to embed it right there.</p>
          <textarea id="media_lines" name="media_lines" style="min-height:110px">${esc(mediaToLines(media))}</textarea>
          <label>Upload images (large photos are shrunk automatically; for videos, paste a YouTube link above)</label><input type="file" name="upload_media" accept="image/*" multiple>
          <label>Custom embed code (HTML, e.g. a Spotify player or poll)</label>
          <textarea name="custom_html" style="min-height:80px;font:13px ui-monospace,monospace">${esc(customHtml)}</textarea>
          ${media.length ? `<div class="cands">${media.map(mediaThumb).join('')}</div>` : ''}
        </fieldset>

        <label>Article (Markdown)</label><textarea class="body" name="body_md">${esc(a.body_md)}</textarea>
        <label>Facebook caption</label><textarea name="fb_caption" style="min-height:70px">${esc(a.fb_caption || '')}</textarea>
        <div class="actions">
          <button name="action" value="save">Save</button>
          <button name="action" value="reject" class="no">Reject</button>
          <button name="action" value="approve" class="go">Approve &amp; publish</button>
        </div>
      </form>
      <h3>Preview</h3><div class="preview"><h1>${esc(a.title)}</h1><p><em>${esc(a.excerpt)}</em></p>${marked.parse(
        a.body_md.replace(/<script[\s\S]*?<\/script>/gi, ''),
      )}</div>
      <script>
        function pickCover(url, credit){
          document.getElementById('cover_url').value = url;
          document.getElementById('cover_credit').value = credit;
          const p = document.getElementById('coverPrev'); p.src = url; p.hidden = false;
        }
        function addMedia(line){
          const t = document.getElementById('media_lines');
          t.value = (t.value.trim() ? t.value.trim() + '\\n' : '') + line;
        }
      </script>`,
      ),
    );
  });

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 45 * 1024 * 1024, files: 8 } });
  const uploadFields = upload.fields([
    { name: 'upload_cover', maxCount: 1 },
    { name: 'upload_media', maxCount: 6 },
  ]);

  app.post('/a/:id', uploadFields, async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body;

    // Media: text box lines, then uploads, then custom HTML
    const { items: media, rejected } = parseMediaLines(b.media_lines);
    let coverUrl = String(b.cover_url || '').trim() || null;
    const coverFile = req.files?.upload_cover?.[0];
    if (coverFile?.size) coverUrl = await uploadToStorage(coverFile, id);
    for (const f of req.files?.upload_media ?? []) {
      if (!f.size) continue;
      const url = await uploadToStorage(f, id);
      media.push({ type: f.mimetype.startsWith('video/') ? 'video' : 'image', url, caption: '', credit: '' });
    }
    const customHtml = String(b.custom_html || '').trim();
    if (customHtml) media.push({ type: 'html', html: customHtml });

    const current = await one('SELECT slug FROM articles WHERE id = ?', [id]);
    const imagePrompt = String(b.image_prompt || '').trim() || null;
    const animeList = String(b.anime || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 3);
    const extra = {};
    if (b.action === 'regen' && current) {
      const art = await createArtwork({ slug: current.slug, title: String(b.title || ''), anime: animeList, category: b.category, imagePrompt });
      if (art.cover_url) {
        coverUrl = art.cover_url;
        b.cover_credit = art.cover_credit;
        extra.social_card_url = art.social_card_url;
      }
    }
    if (b.action === 'approve' && current) {
      try {
        extra.social_card_url = await refreshSocialCard({ slug: current.slug, title: String(b.title || ''), anime: animeList, category: b.category, coverUrl });
      } catch (err) {
        fail('Social card refresh failed:', err.message);
      }
    }

    const edits = {
      ...extra,
      image_prompt: imagePrompt,
      cover_url: coverUrl,
      cover_credit: String(b.cover_credit || '').trim() || null,
      media,
      title: String(b.title || '').trim().slice(0, 140),
      excerpt: String(b.excerpt || '').trim().slice(0, 220),
      category: ['news', 'upcoming', 'release', 'feature'].includes(b.category) ? b.category : 'news',
      anime: String(b.anime || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 3),
      body_md: String(b.body_md || ''),
      fb_caption: String(b.fb_caption || '').trim() || null,
      release_date: /^\d{4}-\d{2}-\d{2}$/.test(b.release_date || '') ? b.release_date : null,
      updated_at: new Date().toISOString(),
    };
    if (b.action === 'approve') Object.assign(edits, { status: 'published', published_at: now() });
    if (b.action === 'reject') edits.status = 'rejected';

    const { clause, params } = setClause(edits);
    const a = await one(`UPDATE articles SET ${clause} WHERE id = ? RETURNING cluster_key`, [...params, id]);
    if (b.action === 'approve' && a?.cluster_key) await creditSources(a.cluster_key);

    const skipped = rejected.length ? ` Not recognised as media (ignored): ${rejected.join(', ')}` : '';
    const msg =
      (b.action === 'approve'
        ? 'Approved. It goes live with the next deploy (within 2 hours), or tap "Deploy now".'
        : b.action === 'reject'
          ? 'Rejected.'
          : b.action === 'regen'
            ? 'New artwork created.'
            : 'Saved.') + skipped;
    res.redirect(b.action === 'save' || b.action === 'regen' ? `/a/${id}?msg=${encodeURIComponent(msg)}` : `/?msg=${encodeURIComponent(msg)}`);
  });

  app.post('/deploy', async (req, res) => {
    try {
      await publish();
      res.redirect(`/?msg=${encodeURIComponent('Deploy triggered. The site updates in 1–3 minutes.')}`);
    } catch (err) {
      fail(err);
      res.redirect(`/?msg=${encodeURIComponent('Deploy failed: ' + err.message)}`);
    }
  });

  app.get('/published', async (req, res) => {
    const rows = await sql(
      "SELECT id, slug, title, views, published_at, fb_posted FROM articles WHERE status = 'published' ORDER BY published_at DESC LIMIT 50",
    );
    const trs = rows
      .map(
        (r) => `<tr><td><a href="${esc(CONFIG.siteUrl)}/news/${esc(r.slug)}/" target="_blank">${esc(r.title)}</a>
        <div class="meta"><a href="/a/${r.id}">edit</a></div></td><td>${r.views}</td><td>${r.fb_posted ? '✓' : '–'}</td><td>${ago(r.published_at)}</td></tr>`,
      )
      .join('');
    res.send(page('Published', `<table><tr><th>Article</th><th>Views</th><th>FB</th><th>When</th></tr>${trs}</table>`));
  });

  app.get('/sources', async (req, res) => {
    const rows = await sql('SELECT * FROM sources ORDER BY tier, items_used DESC');
    const trs = rows
      .map(
        (s) => `<tr><td>${esc(s.name)}<div class="meta">${s.last_error ? `<span class="err">${esc(s.last_error)}</span>` : s.last_ok_at ? 'OK ' + ago(s.last_ok_at) : 'not run yet'}</div></td>
        <td>${s.tier}</td><td>${s.items_used}/${s.items_seen}</td><td>${s.enabled ? 'on' : 'off'}</td></tr>`,
      )
      .join('');
    res.send(
      page(
        'Sources',
        `<p class="meta">Add or edit sources in Cloudflare → D1 → anime-support → sources (or with SQL in its Console). "Used" counts headlines that became published articles.</p>
        <table><tr><th>Source</th><th>Tier</th><th>Used/seen</th><th>On</th></tr>${trs}</table>`,
      ),
    );
  });

  app.use((err, req, res, _next) => {
    fail(err);
    res.status(500).send(page('Error', `<p class="err">${esc(err.message)}</p>`));
  });
  return app;
}

/** Saves an uploaded file in the D1 media table and returns its site path. */
async function uploadToStorage(file, articleId) {
  const ext = (file.originalname.match(/\.(\w{2,5})$/)?.[1] || file.mimetype.split('/')[1] || 'bin').toLowerCase();
  const path = `articles/${articleId}/upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  return uploadBuffer(file.buffer, path, file.mimetype);
}

function ytThumb(url) {
  const id = classifyUrl(url)?.id;
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
}

function mediaThumb(m) {
  const label = { youtube: 'YouTube', x: 'X post', instagram: 'Instagram', tiktok: 'TikTok', video: 'Video', image: 'Image', html: 'Custom embed' }[m.type] || m.type;
  const img = m.type === 'image' ? m.url : m.type === 'youtube' ? ytThumb(m.url) : '';
  return `<div class="cand">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<div class="ph"></div>'}<span>${label}${m.caption ? ' · ' + esc(m.caption) : ''}</span></div>`;
}

/** Each source whose headline fed a published article earns +1 "used" (feeds the source ranking). */
async function creditSources(clusterKey) {
  await sql(
    'UPDATE sources SET items_used = items_used + 1 WHERE id IN (SELECT DISTINCT source_id FROM raw_items WHERE cluster_key = ?)',
    [clusterKey],
  );
}

export function startReviewServer() {
  if (!CONFIG.review.password) log('WARNING: REVIEW_PASSWORD is empty; anyone on your Wi-Fi can open the dashboard.');
  return createApp().listen(CONFIG.review.port, '0.0.0.0', () =>
    log(`Review dashboard: http://localhost:${CONFIG.review.port}`),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) startReviewServer();
