// Sign in with Google (OAuth 2.0 + PKCE) and Sign in with Apple. Each turns on when its keys are set
// as Worker secrets (see README → Creator Studio). Sessions: random cookie, only its hash in D1.
import { json, fail, cookies, cookie, sha256, randomToken, b64url, b64urlDecode, decodeJwt, siteOrigin, safeReturn, rateLimit, ipHash, nowIso } from './lib.js';

const SESSION_DAYS = 30;
const GOOGLE_AUTH = (env) => env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = (env) => env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const APPLE_BASE = (env) => env.APPLE_BASE_URL || 'https://appleid.apple.com';

export const providers = (env) => ({
  google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  apple: Boolean(env.APPLE_SERVICES_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY),
  dev: env.DEV_LOGIN === '1',
});

/* ---------------- sessions ---------------- */

export async function currentUser(request, env) {
  const token = cookies(request).as_sid;
  if (!token) return null;
  const user = await env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?`,
  )
    .bind(await sha256(token), nowIso())
    .first();
  if (!user || user.banned) return null;
  return user;
}

export async function requireUser(request, env, role) {
  const user = await currentUser(request, env);
  if (!user) fail(401, 'Please sign in first.', 'auth');
  if (role === 'moderator' && !['moderator', 'admin'].includes(user.role)) fail(403, 'Moderators only.', 'role');
  if (role === 'admin' && user.role !== 'admin') fail(403, 'Admins only.', 'role');
  return user;
}

async function startSession(env, userId) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').bind(await sha256(token), userId, expires).run();
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(nowIso()).run();
  return cookie('as_sid', token, { maxAge: SESSION_DAYS * 86400 });
}

/* ---------------- users ---------------- */

const slug = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 18);

async function uniqueHandle(env, base) {
  let h = slug(base);
  if (h.length < 3) h = `creator_${h}`.slice(0, 18);
  for (let i = 0; i < 20; i++) {
    const candidate = i ? `${h}_${Math.floor(Math.random() * 9000 + 1000)}` : h;
    const taken = await env.DB.prepare('SELECT 1 FROM users WHERE handle = ?').bind(candidate).first();
    if (!taken) return candidate;
  }
  return `creator_${randomToken(6).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

async function upsertUser(env, { provider, sub, email, emailVerified, name, avatar }) {
  const admins = String(env.ADMIN_EMAILS || '')
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const isAdmin = Boolean(email && emailVerified && admins.includes(email.toLowerCase()));
  let user = await env.DB.prepare('SELECT * FROM users WHERE provider = ? AND provider_sub = ?').bind(provider, sub).first();
  if (!user) {
    const handle = await uniqueHandle(env, name || (email || '').split('@')[0]);
    user = await env.DB.prepare(
      `INSERT INTO users (provider, provider_sub, email, email_verified, name, handle, avatar_url, role, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    )
      .bind(provider, sub, email || null, emailVerified ? 1 : 0, (name || handle).slice(0, 60), handle, avatar || null, isAdmin ? 'admin' : 'user', nowIso())
      .first();
  } else {
    user = await env.DB.prepare(
      `UPDATE users SET email = COALESCE(?, email), email_verified = MAX(email_verified, ?), avatar_url = COALESCE(avatar_url, ?),
         role = CASE WHEN ? THEN 'admin' ELSE role END, last_seen_at = ? WHERE id = ? RETURNING *`,
    )
      .bind(email || null, emailVerified ? 1 : 0, avatar || null, isAdmin ? 1 : 0, nowIso(), user.id)
      .first();
  }
  if (user.banned) fail(403, 'This account is suspended.', 'banned');
  return user;
}

const redirect = (location, setCookies = []) => {
  const h = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const c of setCookies) h.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers: h });
};
const errorPage = (env, msg) => redirect(`${siteOrigin(env)}/account/?error=${encodeURIComponent(msg)}`);

/* ---------------- Google ---------------- */

async function googleStart(request, env) {
  if (!providers(env).google) fail(503, 'Google sign-in is not set up yet.', 'provider');
  const url = new URL(request.url);
  const state = randomToken(16);
  const verifier = randomToken(48);
  const nonce = randomToken(16);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const auth = new URL(GOOGLE_AUTH(env));
  auth.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${siteOrigin(env)}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  const payload = JSON.stringify({ state, verifier, nonce, ret: safeReturn(url.searchParams.get('return')) });
  return redirect(auth.toString(), [cookie('as_oauth', payload, { maxAge: 600 })]);
}

async function googleCallback(request, env) {
  const url = new URL(request.url);
  let saved;
  try {
    saved = JSON.parse(cookies(request).as_oauth || '');
  } catch {
    return errorPage(env, 'Sign-in expired. Please try again.');
  }
  if (url.searchParams.get('error')) return errorPage(env, 'Sign-in was cancelled.');
  if (!saved?.state || url.searchParams.get('state') !== saved.state) return errorPage(env, 'Sign-in check failed. Please try again.');
  const res = await fetch(GOOGLE_TOKEN(env), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: url.searchParams.get('code') || '',
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${siteOrigin(env)}/api/auth/google/callback`,
      grant_type: 'authorization_code',
      code_verifier: saved.verifier,
    }),
  });
  const tok = await res.json().catch(() => ({}));
  if (!res.ok || !tok.id_token) return errorPage(env, 'Google did not confirm the sign-in.');
  // The token came straight from Google over TLS (back channel), so its claims can be read directly.
  const claims = decodeJwt(tok.id_token);
  const issOk = ['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss) || env.GOOGLE_TOKEN_URL;
  if (!issOk || claims.aud !== env.GOOGLE_CLIENT_ID || claims.nonce !== saved.nonce || claims.exp * 1000 < Date.now()) {
    return errorPage(env, 'Google sign-in could not be verified.');
  }
  const user = await upsertUser(env, {
    provider: 'google',
    sub: String(claims.sub),
    email: claims.email,
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    name: claims.name,
    avatar: claims.picture,
  });
  return redirect(`${siteOrigin(env)}${saved.ret}`, [await startSession(env, user.id), cookie('as_oauth', '', { maxAge: 0 })]);
}

/* ---------------- Apple ---------------- */

async function appleClientSecret(env) {
  const pem = String(env.APPLE_PRIVATE_KEY).replace(/\\n/g, '\n');
  const der = b64urlDecode(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_'));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'ES256', kid: env.APPLE_KEY_ID })));
  const body = b64url(
    new TextEncoder().encode(JSON.stringify({ iss: env.APPLE_TEAM_ID, iat: now, exp: now + 600, aud: 'https://appleid.apple.com', sub: env.APPLE_SERVICES_ID })),
  );
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

async function appleStart(request, env) {
  if (!providers(env).apple) fail(503, 'Apple sign-in is not set up yet.', 'provider');
  const url = new URL(request.url);
  const state = randomToken(16);
  const nonce = randomToken(16);
  const auth = new URL(`${APPLE_BASE(env)}/auth/authorize`);
  auth.search = new URLSearchParams({
    client_id: env.APPLE_SERVICES_ID,
    redirect_uri: `${siteOrigin(env)}/api/auth/apple/callback`,
    response_type: 'code',
    response_mode: 'form_post',
    scope: 'name email',
    state,
    nonce,
  });
  // Apple posts back from its own domain, so this cookie must be SameSite=None
  const payload = JSON.stringify({ state, nonce, ret: safeReturn(url.searchParams.get('return')) });
  return redirect(auth.toString(), [cookie('as_apple', payload, { maxAge: 600, sameSite: 'None' })]);
}

async function appleCallback(request, env) {
  const form = await request.formData();
  let saved;
  try {
    saved = JSON.parse(cookies(request).as_apple || '');
  } catch {
    return errorPage(env, 'Sign-in expired. Please try again.');
  }
  if (form.get('error')) return errorPage(env, 'Sign-in was cancelled.');
  if (!saved?.state || form.get('state') !== saved.state) return errorPage(env, 'Sign-in check failed. Please try again.');
  const res = await fetch(`${APPLE_BASE(env)}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.APPLE_SERVICES_ID,
      client_secret: await appleClientSecret(env),
      code: String(form.get('code') || ''),
      grant_type: 'authorization_code',
      redirect_uri: `${siteOrigin(env)}/api/auth/apple/callback`,
    }),
  });
  const tok = await res.json().catch(() => ({}));
  if (!res.ok || !tok.id_token) return errorPage(env, 'Apple did not confirm the sign-in.');
  const claims = decodeJwt(tok.id_token);
  if (claims.aud !== env.APPLE_SERVICES_ID || (claims.nonce && claims.nonce !== saved.nonce) || claims.exp * 1000 < Date.now()) {
    return errorPage(env, 'Apple sign-in could not be verified.');
  }
  let name = '';
  try {
    const u = JSON.parse(String(form.get('user') || '{}')); // sent only on the very first sign-in
    name = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(' ');
  } catch {}
  const user = await upsertUser(env, {
    provider: 'apple',
    sub: String(claims.sub),
    email: claims.email,
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    name,
  });
  return redirect(`${siteOrigin(env)}${saved.ret}`, [await startSession(env, user.id), cookie('as_apple', '', { maxAge: 0, sameSite: 'None' })]);
}

/* ---------------- local testing only ---------------- */

async function devLogin(request, env) {
  if (!providers(env).dev) fail(404, 'Not found');
  const url = new URL(request.url);
  const name = url.searchParams.get('name') || 'Test Creator';
  const email = url.searchParams.get('email') || `${slug(name)}@example.com`;
  const user = await upsertUser(env, { provider: 'dev', sub: email, email, emailVerified: true, name });
  if (url.searchParams.get('age')) {
    await env.DB.prepare('UPDATE users SET created_at = ? WHERE id = ?').bind(new Date(Date.now() - Number(url.searchParams.get('age')) * 3600e3).toISOString(), user.id).run();
  }
  return redirect(`${siteOrigin(env)}${safeReturn(url.searchParams.get('return'))}`, [await startSession(env, user.id)]);
}

/* ---------------- router ---------------- */

export async function handleAuth(request, env, path) {
  if (path !== '/api/auth/providers' && path !== '/api/auth/logout') await rateLimit(env, `auth:${await ipHash(request, env)}`, 40, 3600);
  if (path === '/api/auth/providers') return json(providers(env));
  if (path === '/api/auth/google') return googleStart(request, env);
  if (path === '/api/auth/google/callback') return googleCallback(request, env);
  if (path === '/api/auth/apple') return appleStart(request, env);
  if (path === '/api/auth/apple/callback' && request.method === 'POST') return appleCallback(request, env);
  if (path === '/api/auth/dev') return devLogin(request, env);
  if (path === '/api/auth/logout' && request.method === 'POST') {
    const token = cookies(request).as_sid;
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(token)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': cookie('as_sid', '', { maxAge: 0 }) });
  }
  fail(404, 'Not found');
}
