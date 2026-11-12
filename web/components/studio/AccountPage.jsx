'use client';
import { useEffect, useState } from 'react';
import { api, refreshMe, useMe } from '@/lib/studio-client';
import SignIn from './SignIn';

const STATUS = { pending: 'Waiting for review', approved: 'Live', rejected: 'Not accepted', withdrawn: 'Withdrawn', disqualified: 'Disqualified' };

export default function AccountPage() {
  const me = useMe();
  const [error, setError] = useState('');
  useEffect(() => setError(new URLSearchParams(location.search).get('error') || ''), []);
  if (!me) return <div className="glass empty">Loading…</div>;
  if (!me.user) {
    return (
      <>
        {error && <p className="form-error" role="alert">{error}</p>}
        <SignIn providers={me.providers} title="Join the Creator Studio" />
      </>
    );
  }
  return <Signed me={me} />;
}

function Signed({ me }) {
  const u = me.user;
  const [form, setForm] = useState({ name: u.name, handle: u.handle, bio: u.bio, links: u.links.length ? u.links : [{ label: '', url: '' }] });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setLink = (i, k, v) => setForm((f) => ({ ...f, links: f.links.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await api('/api/me', { method: 'POST', json: { ...form, links: form.links.filter((l) => l.label && l.url) } });
      setMsg('Saved.');
      refreshMe();
    } catch (x) {
      setErr(x.message);
    }
    setBusy(false);
  }
  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    location.href = '/';
  }
  async function del() {
    if (!confirm('Delete your account, entries, votes and comments forever? This cannot be undone.')) return;
    await api('/api/me', { method: 'DELETE' });
    location.href = '/';
  }

  return (
    <div className="acct">
      <section className="glass acct-card">
        <div className="acct-head">
          {u.avatar ? <img src={u.avatar} alt={`${u.name} profile picture`} referrerPolicy="no-referrer" /> : <span className="initial big">{u.name[0]?.toUpperCase()}</span>}
          <div>
            <h2>{u.name}</h2>
            <p className="meta">@{u.handle} · {u.followers} followers · {u.following} following{u.role !== 'user' ? ` · ${u.role}` : ''}</p>
            <p className="meta"><a href={`/creators/?u=${u.handle}`}>View your public profile →</a></p>
          </div>
        </div>
        <div className="tabs" style={{ marginTop: 16 }}>
          <a className="chip" href="/contests/">Enter a contest</a>
          {(u.role === 'admin' || u.role === 'moderator') && <a className="chip" href="/studio-admin/">Moderation & admin</a>}
          <button type="button" className="chip" onClick={logout}>Sign out</button>
        </div>
      </section>

      <section className="glass acct-card">
        <h2 className="h3">My entries</h2>
        {me.entries.length ? (
          <ul className="my-entries">
            {me.entries.map((e) => (
              <li key={e.id}>
                <a href={`/contests/entry/?id=${e.id}`} className="thumb-sm">{e.thumb && <img src={e.thumb} alt={`Your entry: ${e.title}`} />}</a>
                <div>
                  <a href={`/contests/entry/?id=${e.id}`}><strong>{e.title}</strong></a>
                  <div className="meta">
                    <a href={`/contests/${e.contest.slug}/`}>{e.contest.title}</a> · <span className={`status s-${e.status}`}>{STATUS[e.status]}</span>
                    {e.votes != null && <> · {e.votes} votes</>}
                  </div>
                  {e.rejectReason && <div className="meta">Reason: {e.rejectReason}</div>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No entries yet. <a href="/contests/">See the open contests →</a></p>
        )}
      </section>

      <form className="glass acct-card form" onSubmit={save}>
        <h2 className="h3">Profile</h2>
        <label>Display name<input value={form.name} maxLength={60} onChange={(e) => set('name', e.target.value)} required /></label>
        <label>Username<input value={form.handle} maxLength={20} pattern="[a-z0-9_]{3,20}" onChange={(e) => set('handle', e.target.value.toLowerCase())} required /><small>3–20 characters: a–z, 0–9 and _</small></label>
        <label>Bio<textarea value={form.bio} maxLength={300} rows={3} onChange={(e) => set('bio', e.target.value)} placeholder="What you make, tools you love, commissions open?" /></label>
        <fieldset>
          <legend>Links and support pages (up to 5)</legend>
          <small>Portfolio, ArtStation, Ko-fi, Patreon, YouTube… Fans can support you directly there. Must start with https://</small>
          {form.links.map((l, i) => (
            <div className="link-row" key={i}>
              <input aria-label="Link name" placeholder="Ko-fi" value={l.label} maxLength={30} onChange={(e) => setLink(i, 'label', e.target.value)} />
              <input aria-label="Link address" placeholder="https://ko-fi.com/you" value={l.url} maxLength={200} onChange={(e) => setLink(i, 'url', e.target.value)} />
            </div>
          ))}
          {form.links.length < 5 && <button type="button" className="chip" onClick={() => set('links', [...form.links, { label: '', url: '' }])}>+ Add link</button>}
        </fieldset>
        {err && <p className="form-error" role="alert">{err}</p>}
        {msg && <p className="form-ok" role="status">{msg}</p>}
        <div><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div>
        <p className="meta">Signed in with {u.provider === 'apple' ? 'Apple' : u.provider === 'google' ? 'Google' : u.provider} as {u.email || 'a private email'}. Only you can see this.</p>
        <p className="meta"><button type="button" className="linkish danger" onClick={del}>Delete my account</button></p>
      </form>
    </div>
  );
}
