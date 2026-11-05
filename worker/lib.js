// Small helpers shared by the Worker's API routes.

export const SITE = 'https://anime.support';
const ORIGINS = new Set([SITE, 'https://www.anime.support']);

export function siteOrigin(env) {
  return (env.SITE_URL || SITE).replace(/\/$/, '');
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const fail = (status, message, code) => {
  throw new HttpError(status, message, code);
};

/** Writes from other websites are refused (CSRF). Our own pages send Origin on every POST. */
export function assertSameOrigin(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = new Set([...ORIGINS, siteOrigin(env)]);
  if (!origin || !allowed.has(origin)) fail(403, 'Requests must come from anime.support.', 'origin');
}

export function cookies(request) {
  const out = {};
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(name, value, { maxAge, sameSite = 'Lax', path = '/' } = {}) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    'HttpOnly',
    'Secure',
    `SameSite=${sameSite}`,
    maxAge != null ? `Max-Age=${maxAge}` : '',
  ]
    .filter(Boolean)
    .join('; ');
}

const enc = new TextEncoder();
export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function randomToken(bytes = 32) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function b64urlDecode(s) {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
}
export function decodeJwt(token) {
  const [, payload] = String(token).split('.');
  return JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
}

/** Visitor IP, hashed with a daily salt: enough to spot vote rings, never stored in clear. */
export async function ipHash(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  return (await sha256(`${env.HASH_SALT || 'anime.support'}|${new Date().toISOString().slice(0, 10)}|${ip}`)).slice(0, 32);
}

/** Fixed-window rate limit stored in D1. Throws 429 when over. */
export async function rateLimit(env, key, limit, windowSec) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, count, reset_at) VALUES (?1, 1, ?2)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN rate_limits.reset_at <= ?3 THEN 1 ELSE rate_limits.count + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at <= ?3 THEN ?2 ELSE rate_limits.reset_at END
     RETURNING count, reset_at`,
  )
    .bind(key, now + windowSec, now)
    .first();
  if (row.count > limit) fail(429, `Too many requests. Try again in ${Math.ceil((row.reset_at - now) / 60)} min.`, 'rate');
}

export async function audit(env, userId, action, target, detail) {
  await env.DB.prepare('INSERT INTO audit_log (user_id, action, target, detail) VALUES (?, ?, ?, ?)')
    .bind(userId ?? null, action, target ?? null, detail ? JSON.stringify(detail).slice(0, 2000) : null)
    .run();
}

export const nowIso = () => new Date().toISOString();

/** Only same-site relative paths, so the login can't be used to bounce people to other sites. */
export function safeReturn(path) {
  return typeof path === 'string' && /^\/(?!\/)[\w\-./?=&%#]*$/.test(path) ? path : '/account/';
}

export function clean(text, max) {
  return String(text ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);
}
