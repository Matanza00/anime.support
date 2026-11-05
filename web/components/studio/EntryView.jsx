'use client';
// One entry: the artwork (image, 3D model you can spin, or video), votes, the creator, comments.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, useMe, useQueryParam, fmtDate } from '@/lib/studio-client';
import SignIn from './SignIn';
import Turnstile, { TURNSTILE_KEY } from './Turnstile';

function Model({ src, poster, alt }) {
  const box = useRef(null);
  useEffect(() => {
    let alive = true;
    import('@google/model-viewer').then(() => {
      if (!alive || !box.current) return;
      const mv = document.createElement('model-viewer');
      Object.entries({ src, poster, alt, 'camera-controls': '', 'auto-rotate': '', 'shadow-intensity': '1', exposure: '1', 'touch-action': 'pan-y', ar: '' }).forEach(([k, v]) => mv.setAttribute(k, v));
      mv.className = 'model';
      box.current.replaceChildren(mv);
    });
    return () => {
      alive = false;
    };
  }, [src, poster, alt]);
  return (
    <div ref={box} className="model-box">
      <img src={poster} alt={alt} />
    </div>
  );
}

export default function EntryView() {
  const id = useQueryParam('id');
  const me = useMe();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState('');
  const onToken = useCallback((t) => setToken(t), []);

  useEffect(() => {
    if (id === null) return;
    if (!/^\d+$/.test(id)) return setErr('Entry not found.');
    api(`/api/entries/${id}`).then((d) => {
      setData(d);
      document.title = `${d.entry.title} by ${d.entry.creator.name} | anime.support`;
    }).catch((x) => setErr(x.message));
  }, [id, me?.user?.id]);

  if (err) return <div className="glass empty">{err} <a href="/contests/">Back to contests</a></div>;
  if (!data) return <div className="glass empty">Loading…</div>;
  const e = data.entry;
  const my = data.my;

  async function vote() {
    setNote('');
    if (TURNSTILE_KEY && !token && !my.voted) return setNote('Please complete the "I am human" check first.');
    setBusy(true);
    try {
      const r = await api(`/api/entries/${e.id}/vote`, { method: 'POST', json: { turnstile: token } });
      setData((d) => ({ ...d, my: { ...d.my, voted: r.voted, votesLeft: r.votesLeft } }));
    } catch (x) {
      setNote(x.message);
    }
    setBusy(false);
  }
  async function send(ev) {
    ev.preventDefault();
    setNote('');
    try {
      const r = await api(`/api/entries/${e.id}/comments`, { method: 'POST', json: { body: comment } });
      setData((d) => ({ ...d, comments: [...d.comments, r.comment] }));
      setComment('');
    } catch (x) {
      setNote(x.message);
    }
  }
  async function report() {
    const reason = prompt('What is wrong with this entry? (for example: stolen art, AI-generated, offensive)');
    if (!reason) return;
    await api('/api/report', { method: 'POST', json: { type: 'entry', id: e.id, reason } }).then(() => alert('Thanks. A moderator will review it.')).catch((x) => alert(x.message));
  }
  const share = typeof location !== 'undefined' ? location.href : '';

  return (
    <article className="entry-page">
      <nav aria-label="Breadcrumb"><ol className="crumbs"><li><a href="/contests/">Contests</a></li><li><a href={`/contests/${e.contest.slug}/`}>{e.contest.title}</a></li></ol></nav>
      {e.status && e.status !== 'approved' && <p className="form-error">This entry is {e.status}{e.rejectReason ? `: ${e.rejectReason}` : ''}. Only you and moderators can see it.</p>}
      <div className="entry-media glass">
        {e.kind === 'image' && <a href={e.media} target="_blank" rel="noopener"><img src={e.media} alt={e.title} /></a>}
        {e.kind === 'video' && <video src={e.media} poster={e.thumb} controls playsInline loop />}
        {e.kind === 'model' && <Model src={e.media} poster={e.thumb} alt={e.title} />}
      </div>
      <div className="two-col section">
        <div>
          {e.winner && <p className="eyebrow">★ Contest winner</p>}
          <h1 className="entry-title">{e.title}</h1>
          <p className="meta">
            In <a href={`/contests/${e.contest.slug}/`}>{e.contest.title}</a> · {fmtDate(e.createdAt)}
            {e.tools && <> · Made with {e.tools}</>}
            {e.fanArt && <> · Fan art</>}
          </p>
          {e.description && <div className="prose entry-desc">{e.description.split(/\n{2,}/).map((t, i) => <p key={i}>{t}</p>)}</div>}

          <div className="entry-actions">
            {e.votes != null && <span className="votes big">{e.votes} votes</span>}
            {my?.canVote && (
              <button type="button" className={`vote-btn big${my.voted ? ' on' : ''}`} aria-pressed={my.voted} disabled={busy || (!my.voted && my.votesLeft === 0)} onClick={vote}>
                {my.voted ? '★ You voted for this' : '☆ Vote for this entry'}
              </button>
            )}
            {my?.canVote && <span className="meta">{my.votesLeft} votes left in this contest</span>}
            {!me?.user && e.contest.phase === 'voting' && <span className="meta">Sign in below to vote.</span>}
            <a className="chip" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${e.title} by ${e.creator.name}`)}&url=${encodeURIComponent(share)}`} target="_blank" rel="noopener">Share on X</a>
            <a className="chip" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(share)}`} target="_blank" rel="noopener">Share on Facebook</a>
            {me?.user && !my?.own && <button type="button" className="chip" onClick={report}>Report</button>}
          </div>
          {my?.canVote && TURNSTILE_KEY && <Turnstile onToken={onToken} />}
          {note && <p className="form-error" role="alert">{note}</p>}

          <section className="section comments">
            <h2 className="h3">Comments ({data.comments.length})</h2>
            {data.comments.map((c) => (
              <div key={c.id} className="comment">
                <a href={`/creators/?u=${c.author.handle}`} className="by">{c.author.avatar && <img src={c.author.avatar} alt="" referrerPolicy="no-referrer" />}{c.author.name}</a>
                <span className="meta">{fmtDate(c.createdAt)}</span>
                <p>{c.body}</p>
              </div>
            ))}
            {me?.user ? (
              <form className="form comment-form" onSubmit={send}>
                <label className="sr-only" htmlFor="cm">Your comment</label>
                <textarea id="cm" rows={3} maxLength={1000} value={comment} onChange={(ev) => setComment(ev.target.value)} placeholder="Say something kind and useful: what works, what you'd love to see" required />
                <div><button className="btn">Post comment</button></div>
              </form>
            ) : (
              me && <SignIn providers={me.providers} title="Sign in to comment and vote" />
            )}
          </section>
        </div>
        <aside className="sidebar">
          <a className="creator-card glass" href={`/creators/?u=${e.creator.handle}`}>
            {e.creator.avatar ? <img src={e.creator.avatar} alt="" referrerPolicy="no-referrer" /> : <span className="initial big">{e.creator.name[0]}</span>}
            <div>
              <strong>{e.creator.name}</strong>
              <span className="meta">@{e.creator.handle}</span>
              {e.creator.bio && <p className="meta">{e.creator.bio}</p>}
              <span className="chip">View profile and support links →</span>
            </div>
          </a>
        </aside>
      </div>
    </article>
  );
}
