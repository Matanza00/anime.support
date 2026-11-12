'use client';
// Live part of a contest page: phase + countdown, your entry, the upload form, the gallery and voting.
import { useCallback, useEffect, useState } from 'react';
import { api, refreshMe, useMe, timeLeft, PHASE_LABEL } from '@/lib/studio-client';
import SignIn from './SignIn';
import SubmitForm from './SubmitForm';
import Turnstile, { TURNSTILE_KEY } from './Turnstile';

const KIND = { image: 'Artwork', model: '3D model', video: 'Video' };

export default function ContestGallery({ slug }) {
  const me = useMe();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [token, setToken] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [, tick] = useState(0);
  const onToken = useCallback((t) => setToken(t), []);

  const load = useCallback(() => api(`/api/contests/${slug}`).then(setData).catch((x) => setErr(x.message)), [slug]);
  useEffect(() => {
    load();
    const t = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, [load, me?.user?.id]);

  if (err) return <div className="glass empty">{err}</div>;
  if (!data) return <div className="glass empty">Loading entries…</div>;
  const c = data.contest;
  const p = c.phase;
  const my = data.my;
  const signedIn = Boolean(me?.user);

  async function vote(id) {
    setNote('');
    if (TURNSTILE_KEY && !token && !my.votedEntryIds.includes(id)) return setNote('Please complete the "I am human" check below first.');
    setBusyId(id);
    try {
      const r = await api(`/api/entries/${id}/vote`, { method: 'POST', json: { turnstile: token } });
      setData((d) => ({
        ...d,
        my: { ...d.my, votesLeft: r.votesLeft, votedEntryIds: r.voted ? [...d.my.votedEntryIds, id] : d.my.votedEntryIds.filter((x) => x !== id) },
      }));
    } catch (x) {
      setNote(x.message);
    }
    setBusyId(null);
  }

  const deadline = p === 'upcoming' ? c.submitOpensAt : p === 'submissions' ? c.submitClosesAt : p === 'voting' ? c.voteClosesAt : null;
  const winner = data.entries.find((e) => e.id === c.winnerEntryId);

  return (
    <div className="contest-live">
      <div className={`phase-bar glass phase-${p}`}>
        <span className="phase-pill">{PHASE_LABEL[p]}</span>
        {deadline && (
          <span>
            {p === 'upcoming' ? 'Entries open in ' : p === 'submissions' ? 'Entries close in ' : 'Voting closes in '}
            <strong>{timeLeft(deadline).replace(' left', '')}</strong>
          </span>
        )}
        {p === 'voting' && my && <span>· You have <strong>{my.votesLeft}</strong> of {data.votesPerContest} votes left</span>}
        {p === 'results' && <span>{winner ? 'Winner confirmed' : 'Votes are in. The winner is announced after verification.'}</span>}
        <span className="grow" />
        <span className="meta">{data.entries.length} {data.entries.length === 1 ? 'entry' : 'entries'}</span>
      </div>

      {p === 'results' && winner && (
        <a className="winner glass" href={`/contests/entry/?id=${winner.id}`}>
          <img src={winner.thumb} alt={`Winning entry: ${winner.title}`} />
          <div>
            <p className="eyebrow">Winner</p>
            <h2>{winner.title}</h2>
            <p>by {winner.creator.name} · {winner.votes} votes</p>
            {c.winnerNote && <p className="meta">{c.winnerNote}</p>}
          </div>
        </a>
      )}

      {p === 'submissions' && (
        <section className="section" id="enter">
          {!signedIn ? (
            me && <SignIn providers={me.providers} title="Sign in to enter" note="Entering is free. Sign in with Google or Apple, then upload your piece here." />
          ) : my?.entry ? (
            <div className="glass panel">
              <h2>Your entry: {my.entry.title}</h2>
              <p className="muted">{my.entry.status === 'pending' ? 'Waiting for a moderator to check it. It appears in the gallery once approved.' : my.entry.status === 'approved' ? 'Your entry is live. Share it so people can vote when voting opens!' : `Status: ${my.entry.status}`}</p>
              <div className="tabs" style={{ margin: '12px 0 0' }}>
                <a className="chip" href={`/contests/entry/?id=${my.entry.id}`}>View</a>
                <button
                  type="button"
                  className="chip"
                  onClick={async () => {
                    if (!confirm('Withdraw this entry? You can upload a new one afterwards.')) return;
                    await api(`/api/entries/${my.entry.id}/withdraw`, { method: 'POST' }).catch((x) => alert(x.message));
                    refreshMe();
                    load();
                  }}
                >
                  Withdraw and replace
                </button>
              </div>
            </div>
          ) : me && !me.storage ? (
            <div className="glass panel"><p className="muted">Uploads open in a moment. Please check back shortly.</p></div>
          ) : (
            <div className="glass panel">
              <h2>Enter this contest</h2>
              <SubmitForm
                contest={c}
                onDone={() => {
                  refreshMe();
                  load();
                }}
              />
            </div>
          )}
        </section>
      )}

      {p === 'voting' && !signedIn && me && (
        <section className="section"><SignIn providers={me.providers} title="Sign in to vote" note={`Each person gets ${data.votesPerContest} votes per contest. Accounts must be at least a day old to vote, which keeps it fair.`} /></section>
      )}
      {p === 'voting' && signedIn && TURNSTILE_KEY && <Turnstile onToken={onToken} />}
      {note && <p className="form-error" role="alert">{note}</p>}

      <section className="section">
        <div className="section-head"><h2>{p === 'results' ? 'Final ranking' : 'Entries'}</h2></div>
        {data.entries.length === 0 ? (
          <div className="glass empty">{p === 'submissions' || p === 'upcoming' ? 'No entries yet. Be the first!' : 'No entries.'}</div>
        ) : (
          <div className="entry-grid">
            {data.entries.map((e, i) => {
              const voted = my?.votedEntryIds.includes(e.id);
              return (
                <article key={e.id} className="entry-card">
                  <a href={`/contests/entry/?id=${e.id}`} className="entry-thumb">
                    <img src={e.thumb} alt={e.title} loading="lazy" />
                    {e.kind !== 'image' && <span className="kind">{KIND[e.kind]}</span>}
                    {p === 'results' && <span className="rank">#{i + 1}</span>}
                  </a>
                  <div className="entry-info">
                    <a href={`/contests/entry/?id=${e.id}`}><h3>{e.title}</h3></a>
                    <a className="by" href={`/creators/?u=${e.creator.handle}`}>
                      {e.creator.avatar && <img src={e.creator.avatar} alt={`${e.creator.name} profile picture`} referrerPolicy="no-referrer" />}
                      {e.creator.name}
                    </a>
                    {p === 'results' && <span className="votes">{e.votes} votes</span>}
                    {p === 'voting' && signedIn && e.creator.handle !== me.user.handle && (
                      <button type="button" className={`vote-btn${voted ? ' on' : ''}`} aria-pressed={voted} disabled={busyId === e.id || (!voted && my.votesLeft === 0)} onClick={() => vote(e.id)}>
                        {voted ? '★ Voted' : '☆ Vote'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {p === 'voting' && <p className="meta" style={{ marginTop: 12 }}>Vote counts stay hidden until voting closes, and entries are shown in a different order for each visitor, so everyone gets a fair look.</p>}
      </section>
    </div>
  );
}
