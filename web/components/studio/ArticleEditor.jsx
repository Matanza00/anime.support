'use client';
// Admin: write a new article or edit any existing one (the bot's included), upload its cover picture and
// pictures inside the text, add reference links, then publish. Publishing rebuilds the site (live in ~3–5 min).
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/studio-client';

const CATS = [['news', 'News'], ['upcoming', 'Upcoming'], ['release', 'Out now'], ['feature', 'Feature / guide']];
const EMPTY = { title: '', slug: '', category: 'news', anime: '', coverUrl: '', coverCredit: '', body: '', excerpt: '', sources: [{ name: '', url: '' }], releaseDate: '', status: 'published' };

const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90).replace(/-+$/, '');

/** Shrinks a picture in the browser (max 1600 px wide, WebP) so uploads are small and pages load fast. */
async function shrink(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Use a JPG, PNG or WebP picture.');
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / img.width);
  if (scale === 1 && file.type === 'image/webp' && file.size < 900e3) return file;
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.86));
  return blob && blob.size < file.size ? new File([blob], 'image.webp', { type: 'image/webp' }) : file;
}
async function uploadPicture(file, name) {
  const fd = new FormData();
  fd.append('file', await shrink(file));
  fd.append('name', name || 'image');
  return (await api('/api/admin/articles/image', { method: 'POST', body: fd })).url;
}

export default function ArticleEditor() {
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null); // null = list view
  const load = (query = q) => api(`/api/admin/articles${query ? `?q=${encodeURIComponent(query)}` : ''}`).then((d) => setList(d.articles)).catch((x) => setList({ error: x.message }));
  useEffect(() => void load(''), []);

  async function edit(id) {
    const { article: a } = await api(`/api/admin/articles/${id}`);
    setForm({ ...EMPTY, ...a, id: a.id, anime: (a.anime || []).join(', '), sources: a.sources?.length ? a.sources : [{ name: '', url: '' }], releaseDate: a.releaseDate || '', coverUrl: a.coverUrl || '', coverCredit: a.coverCredit || '', slugEdited: true });
  }

  if (form) return <Form initial={form} onClose={() => { setForm(null); load(); }} />;
  return (
    <div>
      <div className="section-head" style={{ gap: 12, flexWrap: 'wrap' }}>
        <h2>Articles</h2>
        <button type="button" className="btn" onClick={() => setForm({ ...EMPTY })}>+ Write new article</button>
      </div>
      <form className="tabs" onSubmit={(e) => { e.preventDefault(); load(q); }}>
        <input className="input" placeholder="Search headlines…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <button className="chip" type="submit">Search</button>
      </form>
      {!list ? <p className="muted">Loading…</p> : list.error ? <p className="form-error">{list.error}</p> : (
        <div className="admin-list">
          {list.map((a) => (
            <div key={a.id} className="glass admin-row">
              {a.coverUrl ? <img src={a.coverUrl} alt={`Cover of ${a.title}`} /> : <span className="noimg" />}
              <div>
                <b>{a.title}</b>
                <p className="meta">{a.status === 'draft' ? 'Draft' : `Published ${a.publishedAt?.slice(0, 10) || ''}`} · {CATS.find((c) => c[0] === a.category)?.[1]} · {a.manual ? 'written by you' : 'bot'}</p>
              </div>
              <div className="tabs">
                {a.status === 'published' && <a className="chip" href={`/news/${a.slug}/`} target="_blank" rel="noopener">View</a>}
                <button type="button" className="chip" onClick={() => edit(a.id)}>Edit</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Form({ initial, onClose }) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);
  const bodyRef = useRef(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const slug = f.slugEdited ? slugify(f.slug) : slugify(f.title);

  function insert(text) {
    const el = bodyRef.current;
    const s = el?.selectionStart ?? f.body.length, e = el?.selectionEnd ?? f.body.length;
    const next = f.body.slice(0, s) + text + f.body.slice(e);
    setF((x) => ({ ...x, body: next }));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(s + text.length, s + text.length); });
  }
  const wrap = (before, after = before, ph = 'text') => {
    const el = bodyRef.current;
    const s = el?.selectionStart ?? 0, e = el?.selectionEnd ?? 0;
    insert(before + (f.body.slice(s, e) || ph) + after);
  };

  async function pickCover(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('Uploading picture…'); setErr('');
    try { setF((x) => ({ ...x, coverUrl: '' })); const url = await uploadPicture(file, slug || 'cover'); setF((x) => ({ ...x, coverUrl: url })); } catch (x) { setErr(x.message); }
    setBusy('');
  }
  async function pickInline(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const caption = prompt('Caption for this picture (who/what it shows, and credit):', '') ?? '';
    setBusy('Uploading picture…'); setErr('');
    try { const url = await uploadPicture(file, slug || 'image'); insert(`\n\n![${caption.replace(/[[\]]/g, '')}](${url})\n\n`); } catch (x) { setErr(x.message); }
    setBusy('');
  }

  async function save(status) {
    setErr(''); setDone(null);
    if (status === 'rejected' && !confirm('Take this article off the website?')) return;
    setBusy(status === 'draft' ? 'Saving draft…' : status === 'rejected' ? 'Unpublishing…' : 'Publishing…');
    try {
      const payload = {
        title: f.title, slug, category: f.category, anime: f.anime, coverUrl: f.coverUrl, coverCredit: f.coverCredit, body: f.body,
        excerpt: f.excerpt, sources: f.sources.filter((s) => s.url.trim()), releaseDate: f.releaseDate, status,
      };
      const r = await api(f.id ? `/api/admin/articles/${f.id}` : '/api/admin/articles', { method: 'POST', json: payload });
      setF((x) => ({ ...x, id: r.article.id, slugEdited: true, slug: r.article.slug, status: r.article.status }));
      setDone({ status, url: r.url, deploying: r.deploying });
    } catch (x) { setErr(x.message); }
    setBusy('');
  }

  const words = f.body.trim() ? f.body.trim().split(/\s+/).length : 0;
  return (
    <div className="article-editor">
      <div className="section-head"><h2>{f.id ? 'Edit article' : 'New article'}</h2><button type="button" className="chip" onClick={onClose}>← All articles</button></div>

      <label className="field"><span>Headline</span>
        <input className="input big" value={f.title} onChange={set('title')} placeholder="e.g. Chainsaw Man Season 2 Confirmed for 2027 with New Teaser" maxLength={180} />
      </label>
      <label className="field"><span>Web address</span>
        <div className="slug-row"><span className="muted">anime.support/news/</span>
          <input className="input" value={slug} onChange={(e) => setF((x) => ({ ...x, slug: e.target.value, slugEdited: true }))} placeholder="created from the headline" />
          <span className="muted">/</span>
        </div>
        {f.id && f.status === 'published' && <small className="muted">Changing the address of a published article breaks links people already shared.</small>}
      </label>
      <div className="field-row">
        <label className="field"><span>Section</span>
          <select className="input" value={f.category} onChange={set('category')}>{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
        <label className="field" style={{ flex: 2 }}><span>Anime it's about <small className="muted">(comma separated, links it to the show's page)</small></span>
          <input className="input" value={f.anime} onChange={set('anime')} placeholder="e.g. Chainsaw Man" />
        </label>
        <label className="field"><span>Release date <small className="muted">(only if official)</small></span>
          <input className="input" type="date" value={f.releaseDate} onChange={set('releaseDate')} />
        </label>
      </div>

      <div className="field"><span>Cover picture</span>
        <div className="cover-pick">
          {f.coverUrl ? <img src={f.coverUrl} alt="Cover preview" /> : <div className="noimg">16:9 works best (e.g. 1600 × 900)</div>}
          <div>
            <label className="chip file-btn">{f.coverUrl ? 'Change picture' : 'Upload picture'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickCover} hidden /></label>
            {f.coverUrl && <button type="button" className="chip" onClick={() => setF((x) => ({ ...x, coverUrl: '' }))}>Remove</button>}
            <input className="input" value={f.coverCredit} onChange={set('coverCredit')} placeholder="Picture credit, e.g. © Tatsuki Fujimoto/Shueisha, MAPPA" style={{ marginTop: 8 }} />
          </div>
        </div>
      </div>

      <div className="field"><span>Article <small className="muted">({words} words)</small></span>
        <div className="toolbar tabs">
          <button type="button" className="chip" onClick={() => insert('\n\n## Heading\n\n')}>Heading</button>
          <button type="button" className="chip" onClick={() => wrap('**')}>Bold</button>
          <button type="button" className="chip" onClick={() => wrap('*')}>Italic</button>
          <button type="button" className="chip" onClick={() => { const u = prompt('Link address (https://…)'); if (u) wrap('[', `](${u})`, 'link text'); }}>Link</button>
          <button type="button" className="chip" onClick={() => insert('\n\n- point one\n- point two\n\n')}>List</button>
          <label className="chip file-btn">Picture<input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickInline} hidden /></label>
          <button type="button" className="chip" onClick={() => { const u = prompt('YouTube or X (Twitter) link to embed'); if (u) insert(`\n\n${u.trim()}\n\n`); }}>Video / post</button>
        </div>
        <textarea ref={bodyRef} className="input body-input" value={f.body} onChange={set('body')} rows={18}
          placeholder={'Write the article here. Leave an empty line between paragraphs.\n\nUse the buttons above for headings, bold, links, pictures and YouTube videos.'} />
      </div>

      <label className="field"><span>Short summary <small className="muted">(optional, shown on cards and in Google; the first paragraph is used if empty)</small></span>
        <textarea className="input" rows={2} value={f.excerpt} onChange={set('excerpt')} maxLength={300} />
      </label>

      <div className="field"><span>Reference links <small className="muted">(where the news comes from, shown as "Sources")</small></span>
        {f.sources.map((s, i) => (
          <div key={i} className="source-row">
            <input className="input" placeholder="Name (e.g. Official X account)" value={s.name} onChange={(e) => setF((x) => ({ ...x, sources: x.sources.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) }))} />
            <input className="input" placeholder="https://…" value={s.url} onChange={(e) => setF((x) => ({ ...x, sources: x.sources.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)) }))} />
            {f.sources.length > 1 && <button type="button" className="chip" aria-label="Remove link" onClick={() => setF((x) => ({ ...x, sources: x.sources.filter((_, j) => j !== i) }))}>✕</button>}
          </div>
        ))}
        {f.sources.length < 10 && <button type="button" className="chip" onClick={() => setF((x) => ({ ...x, sources: [...x.sources, { name: '', url: '' }] }))}>+ Add link</button>}
      </div>

      {err && <p className="form-error" role="alert">{err}</p>}
      {busy && <p className="muted">{busy}</p>}
      {done && (
        <div className="glass panel notice" role="status">
          {done.status === 'published' ? (
            <p><b>Published.</b> {done.deploying ? 'The site is rebuilding; it will be live in about 3–5 minutes at' : 'It goes live with the next site update at'} <a href={done.url} target="_blank" rel="noopener">anime.support{done.url}</a></p>
          ) : done.status === 'draft' ? <p><b>Draft saved.</b> It isn't on the website until you publish it.</p> : <p><b>Taken off the website.</b> The page disappears with the next rebuild (a few minutes).</p>}
        </div>
      )}
      <div className="tabs editor-actions">
        <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => save('published')}>{f.id && f.status === 'published' ? 'Update article' : 'Publish'}</button>
        {f.status !== 'published' && <button type="button" className="chip" disabled={Boolean(busy)} onClick={() => save('draft')}>Save draft</button>}
        {f.id && f.status === 'published' && <button type="button" className="chip danger" disabled={Boolean(busy)} onClick={() => save('rejected')}>Unpublish</button>}
      </div>
    </div>
  );
}
