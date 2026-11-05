'use client';
import { useEffect, useState } from 'react';
import { api, useMe, useQueryParam, fmtDate } from '@/lib/studio-client';

export default function CreatorProfile() {
  const handle = useQueryParam('u');
  const me = useMe();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (handle === null) return;
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) return setErr('Creator not found.');
    api(`/api/users/${handle}`).then((d) => {
      setData(d);
      document.title = `${d.user.name} (@${d.user.handle}) | anime.support creators`;
    }).catch((x) => setErr(x.message));
  }, [handle, me?.user?.id]);

  if (err) return <div className="glass empty">{err}</div>;
  if (!data) return <div className="glass empty">Loading…</div>;
  const u = data.user;

  async function follow() {
    if (!me?.user) return (location.href = '/account/');
    const r = await api(`/api/users/${u.handle}/follow`, { method: 'POST' }).catch((x) => alert(x.message));
    if (r) setData((d) => ({ ...d, user: { ...d.user, followers: r.followers }, my: { ...d.my, following: r.following } }));
  }

  return (
    <div className="profile">
      <header className="profile-head glass">
        {u.avatar ? <img src={u.avatar} alt="" referrerPolicy="no-referrer" /> : <span className="initial huge">{u.name[0]}</span>}
        <div className="grow">
          <h1>{u.name}</h1>
          <p className="meta">@{u.handle}{u.role ? ` · ${u.role}` : ''} · joined {fmtDate(u.joinedAt)}</p>
          {u.bio && <p className="bio">{u.bio}</p>}
          <div className="stats">
            <span><b>{u.followers}</b> fans</span>
            <span><b>{u.stars}</b> votes received</span>
            <span><b>{u.wins}</b> {u.wins === 1 ? 'win' : 'wins'}</span>
            <span><b>{data.entries.length}</b> entries</span>
          </div>
          {u.links.length > 0 && (
            <div className="tabs" style={{ margin: '12px 0 0' }}>
              {u.links.map((l) => (
                <a key={l.url} className="chip" href={l.url} target="_blank" rel="noopener nofollow ugc">{l.label} ↗</a>
              ))}
            </div>
          )}
        </div>
        {!data.my?.self && (
          <button type="button" className={`btn${data.my?.following ? ' ghost' : ''}`} onClick={follow}>{data.my?.following ? 'Following' : 'Follow'}</button>
        )}
        {data.my?.self && <a className="btn ghost" href="/account/">Edit profile</a>}
      </header>
      <section className="section">
        <div className="section-head"><h2>Entries</h2></div>
        {data.entries.length ? (
          <div className="entry-grid">
            {data.entries.map((e) => (
              <a key={e.id} className="entry-card" href={`/contests/entry/?id=${e.id}`}>
                <span className="entry-thumb"><img src={e.thumb} alt={e.title} loading="lazy" />{e.winner && <span className="rank">★ Winner</span>}</span>
                <span className="entry-info"><h3>{e.title}</h3><span className="meta">{e.contest.title}</span></span>
              </a>
            ))}
          </div>
        ) : (
          <div className="glass empty">No entries yet.</div>
        )}
      </section>
      <p className="meta">Support links go to the creator&apos;s own pages. anime.support does not handle payments between fans and creators.</p>
    </div>
  );
}
