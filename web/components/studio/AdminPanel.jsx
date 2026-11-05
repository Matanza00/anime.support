'use client';
// Moderators: review entries, reports, comments and votes. Admins also: contests, winners, roles, bans.
import { useEffect, useState } from 'react';
import { api, useMe, fmtDate, phaseOf, PHASE_LABEL } from '@/lib/studio-client';

const toLocal = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const fromLocal = (v) => new Date(v).toISOString();

export default function AdminPanel() {
  const me = useMe();
  const [tab, setTab] = useState('queue');
  if (!me) return <div className="glass empty">Loading…</div>;
  if (!me.user || !['moderator', 'admin'].includes(me.user.role)) return <div className="glass empty">Moderators and admins only. <a href="/account/">Sign in</a></div>;
  const admin = me.user.role === 'admin';
  const tabs = [['queue', 'Entries to review'], ['reports', 'Reports'], ['contests', 'Contests'], ['votes', 'Vote check'], ...(admin ? [['users', 'People']] : [])];
  return (
    <div className="admin">
      <div className="tabs">{tabs.map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'queue' && <Queue />}
      {tab === 'reports' && <Reports />}
      {tab === 'contests' && <Contests admin={admin} />}
      {tab === 'votes' && <Votes />}
      {tab === 'users' && admin && <Users self={me.user.id} />}
    </div>
  );
}

function Queue() {
  const [data, setData] = useState(null);
  const load = () => api('/api/admin/queue').then(setData).catch((x) => setData({ error: x.message }));
  useEffect(() => void load(), []);
  if (!data) return <p className="muted">Loading…</p>;
  if (data.error) return <p className="form-error">{data.error}</p>;
  async function decide(id, status) {
    let reason = '';
    if (status !== 'approved') {
      reason = prompt('Reason shown to the creator (e.g. "AI-generated", "fan art not allowed", "traced from another artist")') || '';
      if (!reason) return;
    }
    const ok = await api(`/api/admin/entries/${id}`, { method: 'POST', json: { status, reason } }).then(() => true).catch((x) => alert(x.message));
    if (ok) setData((d) => ({ ...d, pending: d.pending.filter((e) => e.id !== id) })); // gone from the list at once
  }
  return data.pending.length === 0 ? (
    <div className="glass empty">Nothing waiting. 🎉</div>
  ) : (
    <div className="review-list">
      {data.pending.map((e) => (
        <article key={e.id} className="review glass">
          <a href={e.media} target="_blank" rel="noopener" className="review-thumb"><img src={e.thumb} alt="" /></a>
          <div>
            <h3>{e.title}</h3>
            <p className="meta">
              {e.contest_title} · {e.kind} · {(e.media_bytes / 1048576).toFixed(1)} MB · by @{e.handle} (account {fmtDate(e.user_created)}) · sent {fmtDate(e.created_at)}
              {e.fan_art ? ' · FAN ART' : ''}
            </p>
            {e.description && <p className="review-desc">{e.description}</p>}
            {e.tools && <p className="meta">Tools: {e.tools}</p>}
            <p className="meta">Check: original work? no AI look? not traced (reverse image search)? safe for all ages? fits the theme?</p>
            <div className="tabs" style={{ margin: '10px 0 0' }}>
              <a className="chip" href={`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(location.origin + e.thumb)}`} target="_blank" rel="noopener">Reverse image search</a>
              <a className="chip" href={`/contests/entry/?id=${e.id}`} target="_blank" rel="noopener">Open entry</a>
              <button type="button" className="btn" onClick={() => decide(e.id, 'approved')}>Approve</button>
              <button type="button" className="btn ghost" onClick={() => decide(e.id, 'rejected')}>Reject</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function Reports() {
  const [data, setData] = useState(null);
  const load = () => api('/api/admin/queue').then(setData);
  useEffect(() => void load(), []);
  if (!data) return <p className="muted">Loading…</p>;
  const href = (r) => (r.target_type === 'entry' ? `/contests/entry/?id=${r.target_id}` : null);
  async function act(r, what) {
    if (what === 'disqualify') {
      const reason = prompt('Reason shown to the creator') || '';
      if (!reason) return;
      await api(`/api/admin/entries/${r.target_id}`, { method: 'POST', json: { status: 'disqualified', reason } }).catch((x) => alert(x.message));
    }
    if (what === 'hide') await api(`/api/admin/comments/${r.target_id}`, { method: 'POST', json: { status: 'hidden' } }).catch((x) => alert(x.message));
    await api(`/api/admin/reports/${r.id}/resolve`, { method: 'POST' });
    load();
  }
  return data.reports.length === 0 ? (
    <div className="glass empty">No open reports.</div>
  ) : (
    <table className="admin-table">
      <thead><tr><th>When</th><th>What</th><th>Reason</th><th>By</th><th /></tr></thead>
      <tbody>
        {data.reports.map((r) => (
          <tr key={r.id}>
            <td>{fmtDate(r.created_at)}</td>
            <td>{href(r) ? <a href={href(r)} target="_blank" rel="noopener">{r.target_type} #{r.target_id}</a> : `${r.target_type} #${r.target_id}`}</td>
            <td>{r.reason}</td>
            <td>@{r.reporter}</td>
            <td className="nowrap">
              {r.target_type === 'entry' && <button type="button" className="chip" onClick={() => act(r, 'disqualify')}>Disqualify</button>}
              {r.target_type === 'comment' && <button type="button" className="chip" onClick={() => act(r, 'hide')}>Hide comment</button>}
              <button type="button" className="chip" onClick={() => act(r, 'dismiss')}>Dismiss</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const EMPTY = { slug: '', title: '', category: '2d-art', theme: '', description: '', prize: '', prizeUsd: 0, allowFanArt: false, submitOpensAt: '', submitClosesAt: '', voteClosesAt: '', status: 'draft' };

function Contests({ admin }) {
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState('');
  const load = () => api('/api/admin/contests').then((d) => setList(d.contests));
  useEffect(() => void load(), []);
  if (!list) return <p className="muted">Loading…</p>;
  async function save(e) {
    e.preventDefault();
    setMsg('');
    try {
      await api('/api/admin/contests', { method: 'POST', json: edit });
      setMsg('Saved. The public contest pages rebuild in about 3 minutes.');
      setEdit(null);
      load();
    } catch (x) {
      setMsg(x.message);
    }
  }
  const f = (k) => ({ value: edit[k] ?? '', onChange: (e) => setEdit({ ...edit, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }) });
  const fd = (k) => ({ type: 'datetime-local', value: toLocal(edit[k]), onChange: (e) => setEdit({ ...edit, [k]: e.target.value ? fromLocal(e.target.value) : '' }), required: true });
  return (
    <div>
      {msg && <p className="form-ok" role="status">{msg}</p>}
      {edit ? (
        <form className="form glass panel" onSubmit={save}>
          <h2 className="h3">{edit.id ? 'Edit contest' : 'New contest'}</h2>
          <label>Title<input {...f('title')} required maxLength={120} /></label>
          <label>URL slug<input {...f('slug')} required pattern="[a-z0-9-]{3,80}" placeholder="2d-original-hero-jan-2027" /></label>
          <label>Category<select {...f('category')}><option value="2d-art">2D artwork</option><option value="3d-character">3D character</option><option value="3d-environment">3D environment</option><option value="motion">Motion & animation</option></select></label>
          <label>Theme (one line)<input {...f('theme')} maxLength={200} /></label>
          <label>Brief<textarea rows={6} {...f('description')} maxLength={4000} /></label>
          <label>Prize (shown to the public)<input {...f('prize')} maxLength={200} placeholder="US$100 cash to 1st place + featured on the home page" /></label>
          <label>Prize value in US$ (for the rules)<input type="number" min="0" {...f('prizeUsd')} /></label>
          <label className="check"><input type="checkbox" checked={Boolean(edit.allowFanArt)} onChange={(e) => setEdit({ ...edit, allowFanArt: e.target.checked })} /> Allow fan art of existing series (not recommended for cash prizes)</label>
          <div className="date-row">
            <label>Entries open<input {...fd('submitOpensAt')} /></label>
            <label>Entries close / voting opens<input {...fd('submitClosesAt')} /></label>
            <label>Voting closes<input {...fd('voteClosesAt')} /></label>
          </div>
          <label>Status<select {...f('status')}><option value="draft">Draft (hidden)</option><option value="published">Published</option><option value="cancelled">Cancelled</option></select></label>
          <div className="tabs"><button className="btn" disabled={!admin}>Save</button><button type="button" className="btn ghost" onClick={() => setEdit(null)}>Cancel</button></div>
          {!admin && <p className="meta">Only admins can change contests.</p>}
        </form>
      ) : (
        <>
          {admin && <button type="button" className="btn" onClick={() => setEdit({ ...EMPTY })}>+ New contest</button>}
          <table className="admin-table">
            <thead><tr><th>Contest</th><th>Phase</th><th>Dates</th><th>Entries</th><th>Prize</th><th /></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.title}</strong><div className="meta">{c.categoryLabel} · /{c.slug}/</div></td>
                  <td>{PHASE_LABEL[phaseOf(c)]}</td>
                  <td className="meta">{fmtDate(c.submitOpensAt)} → {fmtDate(c.submitClosesAt)} → {fmtDate(c.voteClosesAt)}</td>
                  <td>{c.approved} live{c.pending ? `, ${c.pending} waiting` : ''}</td>
                  <td>{c.prize || '—'}</td>
                  <td className="nowrap">
                    <button type="button" className="chip" onClick={() => setEdit(c)}>Edit</button>
                    {c.status === 'published' && <a className="chip" href={`/contests/${c.slug}/`} target="_blank" rel="noopener">View</a>}
                    {admin && phaseOf(c) === 'results' && <Winner contest={c} onDone={load} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Winner({ contest, onDone }) {
  async function pick() {
    const d = await api(`/api/contests/${contest.slug}`);
    const top = d.entries.slice(0, 5).map((e, i) => `${i + 1}. #${e.id} ${e.title} by ${e.creator.name}: ${e.votes} votes`).join('\n');
    const id = prompt(`Top entries by public vote:\n${top}\n\nVerify the top entry (originality, WIP files, eligibility), then type the entry number (#) to confirm as winner:`, d.entries[0]?.id || '');
    if (!id) return;
    const note = prompt('Short public note (optional), e.g. "Verified with work-in-progress files. Congratulations!"') || '';
    await api(`/api/admin/contests/${contest.id}/winner`, { method: 'POST', json: { entryId: Number(id), note } }).then(() => alert('Winner saved.')).catch((x) => alert(x.message));
    onDone();
  }
  return <button type="button" className="chip" onClick={pick}>{contest.winnerEntryId ? 'Change winner' : 'Confirm winner'}</button>;
}

function Votes() {
  const [contests, setContests] = useState(null);
  const [cid, setCid] = useState('');
  const [rows, setRows] = useState(null);
  useEffect(() => void api('/api/admin/contests').then((d) => setContests(d.contests)), []);
  const load = (id) => api(`/api/admin/votes/${id}`).then((d) => setRows(d.votes));
  useEffect(() => void (cid && load(cid)), [cid]);
  if (!contests) return <p className="muted">Loading…</p>;
  async function toggle(v) {
    await api('/api/admin/votes/void', { method: 'POST', json: { entryId: v.entry_id, userId: v.user_id, void: !v.void } });
    load(cid);
  }
  return (
    <div>
      <label className="form">Contest<select value={cid} onChange={(e) => setCid(e.target.value)}><option value="">Choose…</option>{contests.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <p className="meta">Red rows: many votes from one connection (same hashed IP) or accounts made just before voting. Remove votes you believe are fake; the voter can't vote for that entry again.</p>
      {rows && (
        <table className="admin-table">
          <thead><tr><th>Entry</th><th>Voter</th><th>Account age at vote</th><th>Votes from same IP</th><th>When</th><th /></tr></thead>
          <tbody>
            {rows.map((v) => (
              <tr key={`${v.entry_id}-${v.user_id}`} className={v.void ? 'void' : v.sameIpVotes > 3 || v.accountAgeHours < 48 ? 'suspect' : ''}>
                <td>{v.title}</td>
                <td>@{v.handle}</td>
                <td>{v.accountAgeHours} h</td>
                <td>{v.sameIpVotes}</td>
                <td>{fmtDate(v.created_at)}</td>
                <td><button type="button" className="chip" onClick={() => toggle(v)}>{v.void ? 'Restore' : 'Remove vote'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Users({ self }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const load = () => api(`/api/admin/users?q=${encodeURIComponent(q)}`).then((d) => setRows(d.users));
  useEffect(() => void load(), []);
  async function upd(id, body) {
    await api(`/api/admin/users/${id}`, { method: 'POST', json: body }).catch((x) => alert(x.message));
    load();
  }
  return (
    <div>
      <form className="form inline" onSubmit={(e) => (e.preventDefault(), load())}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, username or email" /><button className="btn">Search</button></form>
      <table className="admin-table">
        <thead><tr><th>Person</th><th>Email</th><th>Joined</th><th>Role</th><th /></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className={u.banned ? 'void' : ''}>
              <td><a href={`/creators/?u=${u.handle}`} target="_blank" rel="noopener">{u.name}</a><div className="meta">@{u.handle} · {u.provider}</div></td>
              <td className="meta">{u.email}</td>
              <td className="meta">{fmtDate(u.created_at)}</td>
              <td>
                <select value={u.role} disabled={u.id === self} onChange={(e) => upd(u.id, { role: e.target.value })}>
                  <option value="user">user</option><option value="moderator">moderator</option><option value="admin">admin</option>
                </select>
              </td>
              <td>{u.id !== self && <button type="button" className="chip" onClick={() => confirm(u.banned ? 'Unban?' : 'Ban this person? They are signed out at once.') && upd(u.id, { banned: !u.banned })}>{u.banned ? 'Unban' : 'Ban'}</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
