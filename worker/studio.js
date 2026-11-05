// Creator Studio API: profiles, monthly contests, entries, public voting, follows, comments, moderation.
// Roles: user (enter, vote, comment, follow) · moderator (review entries, comments, reports, votes) · admin (+ contests, roles).
import { json, fail, HttpError, assertSameOrigin, ipHash, rateLimit, audit, nowIso, clean } from './lib.js';
import { currentUser, requireUser, providers } from './auth.js';
import { storageReady, putFile, getFile, deleteFile, sniff } from './storage.js';

const CATEGORIES = {
  '2d-art': { label: '2D artwork', kinds: ['image'] },
  '3d-character': { label: '3D character', kinds: ['model', 'image', 'video'] },
  '3d-environment': { label: '3D environment', kinds: ['model', 'image', 'video'] },
  motion: { label: 'Motion & animation', kinds: ['video'] },
};
const MAX_BYTES = { image: 10 * 1024 * 1024, model: 25 * 1024 * 1024, video: 25 * 1024 * 1024 };
const MAX_THUMB = 1.5 * 1024 * 1024;
const VOTES_PER_CONTEST = 3;

/* ---------------- shared ---------------- */

export function phase(c, now = nowIso()) {
  if (c.status === 'draft') return 'draft';
  if (c.status === 'cancelled') return 'cancelled';
  if (now < c.submit_opens_at) return 'upcoming';
  if (now < c.submit_closes_at) return 'submissions';
  if (now < c.vote_closes_at) return 'voting';
  return 'results';
}

const media = (key) => (key ? `/api/media/${key}` : null);
const pubUser = (u) => (u ? { handle: u.handle, name: u.name, avatar: u.avatar_url } : null);
const isMod = (u) => u && (u.role === 'moderator' || u.role === 'admin');
const ageHours = (u) => (Date.now() - Date.parse(u.created_at)) / 3600e3;
const parseLinks = (s) => {
  try {
    return JSON.parse(s || '[]');
  } catch {
    return [];
  }
};

function contestOut(c, extra = {}) {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    category: c.category,
    categoryLabel: CATEGORIES[c.category]?.label,
    kinds: CATEGORIES[c.category]?.kinds,
    theme: c.theme,
    description: c.description,
    prize: c.prize,
    prizeUsd: c.prize_usd,
    allowFanArt: Boolean(c.allow_fan_art),
    submitOpensAt: c.submit_opens_at,
    submitClosesAt: c.submit_closes_at,
    voteClosesAt: c.vote_closes_at,
    status: c.status,
    phase: phase(c),
    winnerEntryId: c.winner_entry_id,
    winnerNote: c.winner_note,
    ...extra,
  };
}

async function contestBySlug(env, slug, user) {
  const c = await env.DB.prepare('SELECT * FROM contests WHERE slug = ?').bind(slug).first();
  if (!c || (c.status === 'draft' && !isMod(user))) fail(404, 'Contest not found.');
  return c;
}

async function verifyTurnstile(env, token, request) {
  if (!env.TURNSTILE_SECRET) return;
  if (!token) fail(400, 'Please complete the "I am human" check.', 'turnstile');
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: request.headers.get('CF-Connecting-IP') || '' }),
  });
  const out = await res.json().catch(() => ({}));
  if (!out.success) fail(400, 'The "I am human" check failed. Please try again.', 'turnstile');
}

function canParticipate(user) {
  if (!user.email_verified) fail(403, 'Your sign-in account needs a verified email.', 'unverified');
}

/* ---------------- me ---------------- */

async function getMe(request, env) {
  const user = await currentUser(request, env);
  if (!user) return json({ user: null, providers: providers(env), storage: storageReady(env) });
  const entries = (
    await env.DB.prepare(
      `SELECT e.id, e.title, e.status, e.reject_reason, e.thumb_key, e.kind, e.votes, e.created_at, c.slug AS contest_slug, c.title AS contest_title,
              c.vote_closes_at, c.submit_opens_at, c.submit_closes_at, c.status AS contest_status
         FROM entries e JOIN contests c ON c.id = e.contest_id WHERE e.user_id = ? ORDER BY e.created_at DESC LIMIT 50`,
    )
      .bind(user.id)
      .all()
  ).results.map((e) => ({
    id: e.id,
    title: e.title,
    status: e.status,
    rejectReason: e.reject_reason,
    thumb: media(e.thumb_key),
    kind: e.kind,
    votes: phase({ status: e.contest_status, submit_opens_at: e.submit_opens_at, submit_closes_at: e.submit_closes_at, vote_closes_at: e.vote_closes_at }) === 'results' ? e.votes : null,
    contest: { slug: e.contest_slug, title: e.contest_title },
  }));
  const counts = await env.DB.prepare(
    'SELECT (SELECT COUNT(*) FROM follows WHERE followee_id = ?1) AS followers, (SELECT COUNT(*) FROM follows WHERE follower_id = ?1) AS following',
  )
    .bind(user.id)
    .first();
  return json({
    user: {
      id: user.id,
      handle: user.handle,
      name: user.name,
      email: user.email,
      avatar: user.avatar_url,
      bio: user.bio,
      links: parseLinks(user.links),
      role: user.role,
      provider: user.provider,
      createdAt: user.created_at,
      ...counts,
    },
    entries,
    providers: providers(env),
    storage: storageReady(env),
  });
}

async function updateMe(request, env) {
  const user = await requireUser(request, env);
  const b = await request.json().catch(() => ({}));
  const name = clean(b.name, 60) || user.name;
  const bio = clean(b.bio, 300);
  const handle = clean(b.handle, 20).toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) fail(400, 'Username: 3–20 characters, letters, numbers and _ only.', 'handle');
  if (handle !== user.handle && (await env.DB.prepare('SELECT 1 FROM users WHERE handle = ?').bind(handle).first())) fail(409, 'That username is taken.', 'handle');
  const links = (Array.isArray(b.links) ? b.links : [])
    .slice(0, 5)
    .map((l) => ({ label: clean(l?.label, 30), url: clean(l?.url, 200) }))
    .filter((l) => l.label && /^https:\/\/[^\s<>"']+$/i.test(l.url));
  await env.DB.prepare('UPDATE users SET name = ?, bio = ?, handle = ?, links = ? WHERE id = ?').bind(name, bio, handle, JSON.stringify(links), user.id).run();
  return json({ ok: true });
}

async function deleteMe(request, env) {
  const user = await requireUser(request, env);
  const files = (await env.DB.prepare('SELECT media_key, thumb_key FROM entries WHERE user_id = ?').bind(user.id).all()).results;
  for (const f of files) {
    await deleteFile(env, f.media_key).catch(() => {});
    await deleteFile(env, f.thumb_key).catch(() => {});
  }
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();
  await audit(env, user.id, 'account.delete', `user:${user.id}`);
  return json({ ok: true }, 200, { 'Set-Cookie': 'as_sid=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' });
}

/* ---------------- contests ---------------- */

async function listContests(request, env) {
  const rows = (
    await env.DB.prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM entries e WHERE e.contest_id = c.id AND e.status = 'approved') AS entry_count
         FROM contests c WHERE c.status = 'published' ORDER BY c.submit_opens_at DESC LIMIT 60`,
    ).all()
  ).results;
  return json({ contests: rows.map((c) => contestOut(c, { entryCount: c.entry_count })) });
}

async function getContest(request, env, slug) {
  const user = await currentUser(request, env);
  const c = await contestBySlug(env, slug, user);
  const p = phase(c);
  const rows = (
    await env.DB.prepare(
      `SELECT e.id, e.title, e.kind, e.thumb_key, e.votes, e.fan_art, e.created_at, u.handle, u.name, u.avatar_url
         FROM entries e JOIN users u ON u.id = e.user_id
        WHERE e.contest_id = ? AND e.status = 'approved' ORDER BY e.created_at`,
    )
      .bind(c.id)
      .all()
  ).results;
  let entries = rows.map((e) => ({
    id: e.id,
    title: e.title,
    kind: e.kind,
    thumb: media(e.thumb_key),
    fanArt: Boolean(e.fan_art),
    creator: { handle: e.handle, name: e.name, avatar: e.avatar_url },
    votes: p === 'results' ? e.votes : null, // hidden while voting, so nobody chases a leader
  }));
  if (p === 'results') entries.sort((a, b) => b.votes - a.votes || a.id - b.id);
  else {
    // a different, stable order per visitor so the first entries don't collect all the votes
    const seed = user ? user.id : Math.floor(Date.now() / 3600e3);
    entries = entries.map((e) => ({ e, k: Math.sin(e.id * 9301 + seed * 49297) })).sort((a, b) => a.k - b.k).map((x) => x.e);
  }
  let my = null;
  if (user) {
    const voted = (await env.DB.prepare('SELECT entry_id FROM votes WHERE contest_id = ? AND user_id = ? AND void = 0').bind(c.id, user.id).all()).results.map((v) => v.entry_id);
    const mine = await env.DB.prepare("SELECT id, status, title FROM entries WHERE contest_id = ? AND user_id = ? AND status NOT IN ('withdrawn') ORDER BY id DESC").bind(c.id, user.id).first();
    my = { votedEntryIds: voted, votesLeft: Math.max(0, VOTES_PER_CONTEST - voted.length), entry: mine || null };
  }
  return json({ contest: contestOut(c, { entryCount: entries.length }), entries, my, votesPerContest: VOTES_PER_CONTEST });
}

/* ---------------- entries ---------------- */

async function submitEntry(request, env) {
  assertSameOrigin(request, env);
  const user = await requireUser(request, env);
  canParticipate(user);
  if (!storageReady(env)) fail(503, 'Uploads are not switched on yet. Please try again soon.', 'storage');
  await rateLimit(env, `upload:${user.id}`, 10, 86400);
  const form = await request.formData();
  const c = await contestBySlug(env, String(form.get('contest') || ''), user);
  if (phase(c) !== 'submissions') fail(400, 'This contest is not taking entries right now.', 'phase');
  await verifyTurnstile(env, form.get('turnstile'), request);

  const title = clean(form.get('title'), 80);
  const description = clean(form.get('description'), 2000);
  const tools = clean(form.get('tools'), 120);
  if (title.length < 2) fail(400, 'Please give your entry a title.', 'title');
  if (form.get('original') !== 'yes') fail(400, 'You must confirm the work is your own original work.', 'original');
  if (form.get('no_ai') !== 'yes') fail(400, 'You must confirm no generative AI was used.', 'ai');
  if (form.get('rules') !== 'yes') fail(400, 'Please accept the contest rules.', 'rules');
  const fanArt = form.get('fan_art') === 'yes';
  if (fanArt && !c.allow_fan_art) fail(400, 'This contest is for original characters and worlds only (no fan art).', 'fanart');

  const file = form.get('file');
  const thumb = form.get('thumb');
  if (!(file instanceof File) || !file.size) fail(400, 'Please attach your artwork file.', 'file');
  if (!(thumb instanceof File) || !thumb.size) fail(400, 'A preview image is missing. Please pick the file again.', 'thumb');
  const fileBuf = await file.arrayBuffer();
  const thumbBuf = await thumb.arrayBuffer();
  const ft = sniff(fileBuf);
  const tt = sniff(thumbBuf);
  if (!ft) fail(400, 'Unsupported file. Use PNG, JPG or WebP for artwork, GLB for 3D models, MP4 or WebM for video.', 'type');
  if (!CATEGORIES[c.category].kinds.includes(ft.kind)) fail(400, `This contest accepts: ${CATEGORIES[c.category].kinds.join(', ')}.`, 'kind');
  if (fileBuf.byteLength > MAX_BYTES[ft.kind]) fail(413, `File too large (max ${MAX_BYTES[ft.kind] / 1048576} MB).`, 'size');
  if (!tt || tt.kind !== 'image' || thumbBuf.byteLength > MAX_THUMB) fail(400, 'The preview image is invalid or too large.', 'thumb');

  const existing = await env.DB.prepare("SELECT id FROM entries WHERE contest_id = ? AND user_id = ? AND status IN ('pending', 'approved', 'disqualified')").bind(c.id, user.id).first();
  if (existing) fail(409, 'You already have an entry in this contest. Withdraw it first to send a new one.', 'duplicate');

  const entry = await env.DB.prepare(
    `INSERT INTO entries (contest_id, user_id, title, description, tools, kind, media_key, media_type, media_bytes, thumb_key, fan_art)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, 'pending', ?) RETURNING id`,
  )
    .bind(c.id, user.id, title, description, tools, ft.kind, ft.type, fileBuf.byteLength, fanArt ? 1 : 0)
    .first();
  const rand = crypto.randomUUID().slice(0, 8);
  const mediaKey = `e/${entry.id}/${rand}.${ft.ext}`;
  const thumbKey = `e/${entry.id}/${rand}-thumb.${tt.ext}`;
  try {
    await putFile(env, mediaKey, fileBuf, ft.type);
    await putFile(env, thumbKey, thumbBuf, tt.type);
  } catch (err) {
    await env.DB.prepare('DELETE FROM entries WHERE id = ?').bind(entry.id).run();
    throw err;
  }
  await env.DB.prepare('UPDATE entries SET media_key = ?, thumb_key = ? WHERE id = ?').bind(mediaKey, thumbKey, entry.id).run();
  return json({ ok: true, id: entry.id, status: 'pending' }, 201);
}

async function getEntry(request, env, id) {
  const user = await currentUser(request, env);
  const e = await env.DB.prepare(
    `SELECT e.*, u.handle, u.name, u.avatar_url, u.bio, c.slug AS c_slug, c.title AS c_title, c.status AS c_status, c.category,
            c.submit_opens_at, c.submit_closes_at, c.vote_closes_at, c.winner_entry_id
       FROM entries e JOIN users u ON u.id = e.user_id JOIN contests c ON c.id = e.contest_id WHERE e.id = ?`,
  )
    .bind(id)
    .first();
  const owner = user && e && user.id === e.user_id;
  if (!e || (e.status !== 'approved' && !owner && !isMod(user))) fail(404, 'Entry not found.');
  const c = { status: e.c_status, submit_opens_at: e.submit_opens_at, submit_closes_at: e.submit_closes_at, vote_closes_at: e.vote_closes_at };
  const p = phase(c);
  const comments = (
    await env.DB.prepare(
      `SELECT cm.id, cm.body, cm.created_at, u.handle, u.name, u.avatar_url FROM comments cm JOIN users u ON u.id = cm.user_id
        WHERE cm.entry_id = ? AND cm.status = 'visible' ORDER BY cm.created_at LIMIT 200`,
    )
      .bind(id)
      .all()
  ).results.map((cm) => ({ id: cm.id, body: cm.body, createdAt: cm.created_at, author: pubUser({ handle: cm.handle, name: cm.name, avatar_url: cm.avatar_url }) }));
  let voted = false;
  let votesLeft = null;
  if (user) {
    voted = Boolean(await env.DB.prepare('SELECT 1 FROM votes WHERE entry_id = ? AND user_id = ? AND void = 0').bind(id, user.id).first());
    const used = await env.DB.prepare('SELECT COUNT(*) AS n FROM votes WHERE contest_id = ? AND user_id = ? AND void = 0').bind(e.contest_id, user.id).first();
    votesLeft = Math.max(0, VOTES_PER_CONTEST - used.n);
  }
  return json({
    entry: {
      id: e.id,
      title: e.title,
      description: e.description,
      tools: e.tools,
      kind: e.kind,
      media: media(e.media_key),
      mediaType: e.media_type,
      thumb: media(e.thumb_key),
      fanArt: Boolean(e.fan_art),
      status: owner || isMod(user) ? e.status : undefined,
      rejectReason: owner || isMod(user) ? e.reject_reason : undefined,
      votes: p === 'results' || isMod(user) ? e.votes : null,
      winner: e.winner_entry_id === e.id,
      createdAt: e.created_at,
      creator: { handle: e.handle, name: e.name, avatar: e.avatar_url, bio: e.bio },
      contest: { slug: e.c_slug, title: e.c_title, category: e.category, phase: p },
    },
    comments,
    my: user ? { voted, votesLeft, own: owner, canVote: p === 'voting' && !owner && e.status === 'approved' } : null,
  });
}

async function withdrawEntry(request, env, id) {
  assertSameOrigin(request, env);
  const user = await requireUser(request, env);
  const e = await env.DB.prepare('SELECT e.*, c.status AS cs, c.submit_opens_at, c.submit_closes_at, c.vote_closes_at FROM entries e JOIN contests c ON c.id = e.contest_id WHERE e.id = ?').bind(id).first();
  if (!e || e.user_id !== user.id) fail(404, 'Entry not found.');
  if (phase({ status: e.cs, submit_opens_at: e.submit_opens_at, submit_closes_at: e.submit_closes_at, vote_closes_at: e.vote_closes_at }) !== 'submissions')
    fail(400, 'Entries can only be withdrawn while submissions are open.', 'phase');
  await env.DB.prepare("UPDATE entries SET status = 'withdrawn' WHERE id = ?").bind(id).run();
  await deleteFile(env, e.media_key).catch(() => {});
  await deleteFile(env, e.thumb_key).catch(() => {});
  return json({ ok: true });
}

async function vote(request, env, id) {
  assertSameOrigin(request, env);
  const user = await requireUser(request, env);
  canParticipate(user);
  await rateLimit(env, `vote:${user.id}`, 60, 3600);
  const b = await request.json().catch(() => ({}));
  const e = await env.DB.prepare(
    'SELECT e.id, e.user_id, e.status, e.contest_id, c.status AS cs, c.submit_opens_at, c.submit_closes_at, c.vote_closes_at FROM entries e JOIN contests c ON c.id = e.contest_id WHERE e.id = ?',
  )
    .bind(id)
    .first();
  if (!e || e.status !== 'approved') fail(404, 'Entry not found.');
  if (phase({ status: e.cs, submit_opens_at: e.submit_opens_at, submit_closes_at: e.submit_closes_at, vote_closes_at: e.vote_closes_at }) !== 'voting')
    fail(400, 'Voting is not open for this contest.', 'phase');
  if (e.user_id === user.id) fail(400, "You can't vote for your own entry.", 'own');
  const minAge = Number(env.MIN_ACCOUNT_AGE_HOURS ?? 24);
  if (ageHours(user) < minAge) fail(403, `New accounts can vote ${minAge} hours after signing up. This keeps contests fair.`, 'age');

  const existing = await env.DB.prepare('SELECT void FROM votes WHERE entry_id = ? AND user_id = ?').bind(id, user.id).first();
  if (existing && !existing.void) {
    await env.DB.prepare('DELETE FROM votes WHERE entry_id = ? AND user_id = ?').bind(id, user.id).run();
  } else {
    if (existing?.void) fail(403, 'This vote was removed by a moderator.', 'void');
    await verifyTurnstile(env, b.turnstile, request);
    const used = await env.DB.prepare('SELECT COUNT(*) AS n FROM votes WHERE contest_id = ? AND user_id = ? AND void = 0').bind(e.contest_id, user.id).first();
    if (used.n >= VOTES_PER_CONTEST) fail(400, `You have used all ${VOTES_PER_CONTEST} votes in this contest. Remove one to vote for another entry.`, 'limit');
    await env.DB.prepare('INSERT INTO votes (entry_id, user_id, contest_id, ip_hash) VALUES (?, ?, ?, ?)').bind(id, user.id, e.contest_id, await ipHash(request, env)).run();
  }
  await env.DB.prepare('UPDATE entries SET votes = (SELECT COUNT(*) FROM votes WHERE entry_id = ?1 AND void = 0) WHERE id = ?1').bind(id).run();
  const used = await env.DB.prepare('SELECT COUNT(*) AS n FROM votes WHERE contest_id = ? AND user_id = ? AND void = 0').bind(e.contest_id, user.id).first();
  return json({ ok: true, voted: !(existing && !existing.void), votesLeft: Math.max(0, VOTES_PER_CONTEST - used.n) });
}

async function addComment(request, env, id) {
  assertSameOrigin(request, env);
  const user = await requireUser(request, env);
  canParticipate(user);
  await rateLimit(env, `comment:${user.id}`, 20, 3600);
  const b = await request.json().catch(() => ({}));
  const body = clean(b.body, 1000);
  if (body.length < 2) fail(400, 'Write something first.', 'empty');
  if ((body.match(/https?:\/\//g) || []).length > 1) fail(400, 'Only one link per comment, please.', 'links');
  const e = await env.DB.prepare("SELECT id FROM entries WHERE id = ? AND status = 'approved'").bind(id).first();
  if (!e) fail(404, 'Entry not found.');
  const row = await env.DB.prepare('INSERT INTO comments (entry_id, user_id, body) VALUES (?, ?, ?) RETURNING id, created_at').bind(id, user.id, body).first();
  return json({ ok: true, comment: { id: row.id, body, createdAt: row.created_at, author: pubUser(user) } }, 201);
}

async function report(request, env) {
  assertSameOrigin(request, env);
  const user = await requireUser(request, env);
  await rateLimit(env, `report:${user.id}`, 20, 86400);
  const b = await request.json().catch(() => ({}));
  if (!['entry', 'comment', 'user'].includes(b.type) || !Number.isInteger(b.id)) fail(400, 'Bad report.');
  const reason = clean(b.reason, 500);
  if (reason.length < 3) fail(400, 'Please say what is wrong.', 'reason');
  await env.DB.prepare('INSERT INTO reports (target_type, target_id, user_id, reason) VALUES (?, ?, ?, ?)').bind(b.type, b.id, user.id, reason).run();
  return json({ ok: true });
}

/* ---------------- people ---------------- */

async function getUser(request, env, handle) {
  const viewer = await currentUser(request, env);
  const u = await env.DB.prepare('SELECT * FROM users WHERE handle = ? AND banned = 0').bind(handle).first();
  if (!u) fail(404, 'Creator not found.');
  const counts = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM follows WHERE followee_id = ?1) AS followers, (SELECT COUNT(*) FROM follows WHERE follower_id = ?1) AS following,
            (SELECT COALESCE(SUM(votes), 0) FROM entries WHERE user_id = ?1 AND status = 'approved') AS stars,
            (SELECT COUNT(*) FROM contests WHERE winner_entry_id IN (SELECT id FROM entries WHERE user_id = ?1)) AS wins`,
  )
    .bind(u.id)
    .first();
  const entries = (
    await env.DB.prepare(
      `SELECT e.id, e.title, e.kind, e.thumb_key, c.slug, c.title AS ctitle, c.winner_entry_id FROM entries e JOIN contests c ON c.id = e.contest_id
        WHERE e.user_id = ? AND e.status = 'approved' ORDER BY e.created_at DESC LIMIT 60`,
    )
      .bind(u.id)
      .all()
  ).results.map((e) => ({ id: e.id, title: e.title, kind: e.kind, thumb: media(e.thumb_key), winner: e.winner_entry_id === e.id, contest: { slug: e.slug, title: e.ctitle } }));
  const following = viewer ? Boolean(await env.DB.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?').bind(viewer.id, u.id).first()) : false;
  return json({
    user: { handle: u.handle, name: u.name, avatar: u.avatar_url, bio: u.bio, links: parseLinks(u.links), joinedAt: u.created_at, role: u.role === 'user' ? undefined : u.role, ...counts },
    entries,
    my: viewer ? { following, self: viewer.id === u.id } : null,
  });
}

async function follow(request, env, handle) {
  assertSameOrigin(request, env);
  const user = await requireUser(request, env);
  await rateLimit(env, `follow:${user.id}`, 100, 3600);
  const u = await env.DB.prepare('SELECT id FROM users WHERE handle = ? AND banned = 0').bind(handle).first();
  if (!u) fail(404, 'Creator not found.');
  if (u.id === user.id) fail(400, "You can't follow yourself.");
  const del = await env.DB.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ? RETURNING 1').bind(user.id, u.id).first();
  if (!del) await env.DB.prepare('INSERT INTO follows (follower_id, followee_id) VALUES (?, ?)').bind(user.id, u.id).run();
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM follows WHERE followee_id = ?').bind(u.id).first();
  return json({ ok: true, following: !del, followers: n.n });
}

/* ---------------- media ---------------- */

async function serveMedia(request, env, key) {
  const m = /^e\/(\d+)\/[\w-]+\.(png|jpg|webp|glb|mp4|webm)$/.exec(key);
  if (!m) fail(404, 'Not found');
  const e = await env.DB.prepare('SELECT user_id, status FROM entries WHERE id = ?').bind(Number(m[1])).first();
  if (!e) fail(404, 'Not found');
  let pub = e.status === 'approved';
  if (!pub) {
    const user = await currentUser(request, env);
    if (!user || (user.id !== e.user_id && !isMod(user))) fail(404, 'Not found');
  }
  const f = await getFile(env, key, request);
  if (!f) fail(404, 'Not found');
  const extra = f.range ? { 'Content-Range': `bytes ${f.range.start}-${f.range.end}/${f.size}`, 'Content-Length': String(f.range.length) } : {};
  return new Response(f.body, {
    status: f.range ? 206 : 200,
    headers: {
      ...extra,
      'Accept-Ranges': f.size != null ? 'bytes' : 'none',
      'Content-Type': f.contentType,
      'Cache-Control': pub ? 'public, max-age=86400' : 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/* ---------------- moderation (moderator) ---------------- */

async function adminQueue(request, env) {
  await requireUser(request, env, 'moderator');
  const pending = (
    await env.DB.prepare(
      `SELECT e.id, e.title, e.description, e.tools, e.kind, e.media_key, e.media_type, e.media_bytes, e.thumb_key, e.fan_art, e.created_at,
              u.handle, u.name, u.created_at AS user_created, c.title AS contest_title, c.slug AS contest_slug, c.allow_fan_art
         FROM entries e JOIN users u ON u.id = e.user_id JOIN contests c ON c.id = e.contest_id
        WHERE e.status = 'pending' ORDER BY e.created_at LIMIT 100`,
    ).all()
  ).results.map((e) => ({ ...e, media: media(e.media_key), thumb: media(e.thumb_key) }));
  const reports = (await env.DB.prepare('SELECT r.*, u.handle AS reporter FROM reports r JOIN users u ON u.id = r.user_id WHERE r.resolved = 0 ORDER BY r.created_at LIMIT 100').all()).results;
  return json({ pending, reports });
}

async function moderateEntry(request, env, id) {
  assertSameOrigin(request, env);
  const mod = await requireUser(request, env, 'moderator');
  const b = await request.json().catch(() => ({}));
  if (!['approved', 'rejected', 'disqualified', 'pending'].includes(b.status)) fail(400, 'Bad status.');
  const reason = clean(b.reason, 300) || null;
  if (b.status !== 'approved' && b.status !== 'pending' && !reason) fail(400, 'Please give the creator a reason.');
  const row = await env.DB.prepare('UPDATE entries SET status = ?, reject_reason = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ? RETURNING id').bind(b.status, reason, nowIso(), mod.id, id).first();
  if (!row) fail(404, 'Entry not found.');
  await audit(env, mod.id, `entry.${b.status}`, `entry:${id}`, { reason });
  return json({ ok: true });
}

async function moderateComment(request, env, id) {
  assertSameOrigin(request, env);
  const mod = await requireUser(request, env, 'moderator');
  const b = await request.json().catch(() => ({}));
  if (!['visible', 'hidden'].includes(b.status)) fail(400, 'Bad status.');
  await env.DB.prepare('UPDATE comments SET status = ? WHERE id = ?').bind(b.status, id).run();
  await audit(env, mod.id, `comment.${b.status}`, `comment:${id}`);
  return json({ ok: true });
}

async function resolveReport(request, env, id) {
  assertSameOrigin(request, env);
  const mod = await requireUser(request, env, 'moderator');
  await env.DB.prepare('UPDATE reports SET resolved = 1 WHERE id = ?').bind(id).run();
  await audit(env, mod.id, 'report.resolve', `report:${id}`);
  return json({ ok: true });
}

/** Vote audit: who voted, how new their accounts are, and IP clusters (hashed) per entry. */
async function voteAudit(request, env, contestId) {
  await requireUser(request, env, 'moderator');
  const rows = (
    await env.DB.prepare(
      `SELECT v.entry_id, v.user_id, v.ip_hash, v.void, v.created_at, u.handle, u.created_at AS user_created, e.title
         FROM votes v JOIN users u ON u.id = v.user_id JOIN entries e ON e.id = v.entry_id WHERE v.contest_id = ? ORDER BY v.entry_id, v.created_at`,
    )
      .bind(contestId)
      .all()
  ).results;
  const byIp = {};
  for (const r of rows) byIp[r.ip_hash] = (byIp[r.ip_hash] || 0) + 1;
  return json({ votes: rows.map((r) => ({ ...r, sameIpVotes: byIp[r.ip_hash], accountAgeHours: Math.round((Date.parse(r.created_at) - Date.parse(r.user_created)) / 3600e3) })) });
}

async function voidVote(request, env) {
  assertSameOrigin(request, env);
  const mod = await requireUser(request, env, 'moderator');
  const b = await request.json().catch(() => ({}));
  await env.DB.prepare('UPDATE votes SET void = ? WHERE entry_id = ? AND user_id = ?').bind(b.void === false ? 0 : 1, b.entryId, b.userId).run();
  await env.DB.prepare('UPDATE entries SET votes = (SELECT COUNT(*) FROM votes WHERE entry_id = ?1 AND void = 0) WHERE id = ?1').bind(b.entryId).run();
  await audit(env, mod.id, b.void === false ? 'vote.restore' : 'vote.void', `entry:${b.entryId}`, { userId: b.userId });
  return json({ ok: true });
}

/* ---------------- contests and people (admin) ---------------- */

async function adminContests(request, env) {
  await requireUser(request, env, 'moderator');
  const rows = (
    await env.DB.prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM entries e WHERE e.contest_id = c.id AND e.status = 'approved') AS approved,
              (SELECT COUNT(*) FROM entries e WHERE e.contest_id = c.id AND e.status = 'pending') AS pending
         FROM contests c ORDER BY c.submit_opens_at DESC LIMIT 100`,
    ).all()
  ).results;
  return json({ contests: rows.map((c) => contestOut(c, { approved: c.approved, pending: c.pending })) });
}

async function saveContest(request, env, ctx, dispatchDeploy) {
  assertSameOrigin(request, env);
  const admin = await requireUser(request, env, 'admin');
  const b = await request.json().catch(() => ({}));
  const slug = clean(b.slug, 80).toLowerCase();
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) fail(400, 'Slug: lowercase letters, numbers and dashes.');
  if (!CATEGORIES[b.category]) fail(400, 'Unknown category.');
  const dates = ['submitOpensAt', 'submitClosesAt', 'voteClosesAt'].map((k) => {
    const d = new Date(b[k]);
    if (isNaN(d)) fail(400, `Bad date: ${k}`);
    return d.toISOString();
  });
  if (!(dates[0] < dates[1] && dates[1] < dates[2])) fail(400, 'Dates must run: submissions open → submissions close → voting closes.');
  if (!['draft', 'published', 'cancelled'].includes(b.status)) fail(400, 'Bad status.');
  const vals = [slug, clean(b.title, 120), b.category, clean(b.theme, 200), clean(b.description, 4000), clean(b.prize, 200), Math.max(0, Math.round(Number(b.prizeUsd) || 0)), b.allowFanArt ? 1 : 0, ...dates, b.status, nowIso()];
  if (!vals[1]) fail(400, 'Title is required.');
  let row;
  if (b.id) {
    row = await env.DB.prepare(
      `UPDATE contests SET slug = ?, title = ?, category = ?, theme = ?, description = ?, prize = ?, prize_usd = ?, allow_fan_art = ?,
              submit_opens_at = ?, submit_closes_at = ?, vote_closes_at = ?, status = ?, updated_at = ? WHERE id = ? RETURNING *`,
    )
      .bind(...vals, b.id)
      .first();
  } else {
    row = await env.DB.prepare(
      `INSERT INTO contests (slug, title, category, theme, description, prize, prize_usd, allow_fan_art, submit_opens_at, submit_closes_at, vote_closes_at, status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    )
      .bind(...vals)
      .first();
  }
  await audit(env, admin.id, 'contest.save', `contest:${row.id}`, { status: row.status });
  ctx.waitUntil(dispatchDeploy(env).catch((e) => console.log('deploy dispatch failed', e.message))); // rebuild the static contest pages
  return json({ ok: true, contest: contestOut(row) });
}

async function setWinner(request, env, id, ctx, dispatchDeploy) {
  assertSameOrigin(request, env);
  const admin = await requireUser(request, env, 'admin');
  const b = await request.json().catch(() => ({}));
  const c = await env.DB.prepare('SELECT * FROM contests WHERE id = ?').bind(id).first();
  if (!c) fail(404, 'Contest not found.');
  if (phase(c) !== 'results') fail(400, 'Pick the winner after voting closes.');
  if (b.entryId != null) {
    const e = await env.DB.prepare("SELECT id FROM entries WHERE id = ? AND contest_id = ? AND status = 'approved'").bind(b.entryId, id).first();
    if (!e) fail(400, 'That entry is not an approved entry of this contest.');
  }
  await env.DB.prepare('UPDATE contests SET winner_entry_id = ?, winner_note = ?, updated_at = ? WHERE id = ?').bind(b.entryId ?? null, clean(b.note, 300) || null, nowIso(), id).run();
  await audit(env, admin.id, 'contest.winner', `contest:${id}`, { entryId: b.entryId });
  ctx.waitUntil(dispatchDeploy(env).catch(() => {}));
  return json({ ok: true });
}

async function adminUsers(request, env) {
  await requireUser(request, env, 'admin');
  const q = clean(new URL(request.url).searchParams.get('q'), 60);
  const rows = (
    await env.DB.prepare(
      `SELECT id, handle, name, email, role, banned, provider, created_at FROM users
        WHERE ?1 = '' OR handle LIKE ?2 OR name LIKE ?2 OR email LIKE ?2 ORDER BY created_at DESC LIMIT 50`,
    )
      .bind(q, `%${q}%`)
      .all()
  ).results;
  return json({ users: rows });
}

async function updateUserRole(request, env, id) {
  assertSameOrigin(request, env);
  const admin = await requireUser(request, env, 'admin');
  const b = await request.json().catch(() => ({}));
  if (id === admin.id && (b.role && b.role !== 'admin')) fail(400, "You can't remove your own admin role.");
  if (b.role && !['user', 'moderator', 'admin'].includes(b.role)) fail(400, 'Bad role.');
  if (b.role) await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(b.role, id).run();
  if (typeof b.banned === 'boolean') {
    await env.DB.prepare('UPDATE users SET banned = ? WHERE id = ?').bind(b.banned ? 1 : 0, id).run();
    if (b.banned) await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
  }
  await audit(env, admin.id, 'user.update', `user:${id}`, b);
  return json({ ok: true });
}

/* ---------------- router ---------------- */

export async function handleStudio(request, env, ctx, path, dispatchDeploy) {
  const M = request.method;
  let m;
  const id = (s) => {
    const n = Number(s);
    if (!Number.isInteger(n) || n <= 0) fail(400, 'Bad id.');
    return n;
  };
  if (path === '/api/me') {
    if (M === 'GET') return getMe(request, env);
    if (M === 'POST') {
      assertSameOrigin(request, env);
      return updateMe(request, env);
    }
    if (M === 'DELETE') {
      assertSameOrigin(request, env);
      return deleteMe(request, env);
    }
  }
  if (path === '/api/contests' && M === 'GET') return listContests(request, env);
  if ((m = /^\/api\/contests\/([a-z0-9-]+)$/.exec(path)) && M === 'GET') return getContest(request, env, m[1]);
  if (path === '/api/entries' && M === 'POST') return submitEntry(request, env);
  if ((m = /^\/api\/entries\/(\d+)$/.exec(path)) && M === 'GET') return getEntry(request, env, id(m[1]));
  if ((m = /^\/api\/entries\/(\d+)\/withdraw$/.exec(path)) && M === 'POST') return withdrawEntry(request, env, id(m[1]));
  if ((m = /^\/api\/entries\/(\d+)\/vote$/.exec(path)) && M === 'POST') return vote(request, env, id(m[1]));
  if ((m = /^\/api\/entries\/(\d+)\/comments$/.exec(path)) && M === 'POST') return addComment(request, env, id(m[1]));
  if (path === '/api/report' && M === 'POST') return report(request, env);
  if ((m = /^\/api\/users\/([a-z0-9_]{3,20})$/.exec(path)) && M === 'GET') return getUser(request, env, m[1]);
  if ((m = /^\/api\/users\/([a-z0-9_]{3,20})\/follow$/.exec(path)) && M === 'POST') return follow(request, env, m[1]);
  if ((m = /^\/api\/media\/(.+)$/.exec(path)) && M === 'GET') return serveMedia(request, env, m[1]);

  if (path === '/api/admin/queue' && M === 'GET') return adminQueue(request, env);
  if ((m = /^\/api\/admin\/entries\/(\d+)$/.exec(path)) && M === 'POST') return moderateEntry(request, env, id(m[1]));
  if ((m = /^\/api\/admin\/comments\/(\d+)$/.exec(path)) && M === 'POST') return moderateComment(request, env, id(m[1]));
  if ((m = /^\/api\/admin\/reports\/(\d+)\/resolve$/.exec(path)) && M === 'POST') return resolveReport(request, env, id(m[1]));
  if ((m = /^\/api\/admin\/votes\/(\d+)$/.exec(path)) && M === 'GET') return voteAudit(request, env, id(m[1]));
  if (path === '/api/admin/votes/void' && M === 'POST') return voidVote(request, env);
  if (path === '/api/admin/contests') {
    if (M === 'GET') return adminContests(request, env);
    if (M === 'POST') return saveContest(request, env, ctx, dispatchDeploy);
  }
  if ((m = /^\/api\/admin\/contests\/(\d+)\/winner$/.exec(path)) && M === 'POST') return setWinner(request, env, id(m[1]), ctx, dispatchDeploy);
  if (path === '/api/admin/users' && M === 'GET') return adminUsers(request, env);
  if ((m = /^\/api\/admin\/users\/(\d+)$/.exec(path)) && M === 'POST') return updateUserRole(request, env, id(m[1]));
  fail(404, 'Not found');
}

export { HttpError };
