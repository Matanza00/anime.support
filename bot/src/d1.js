// Cloudflare D1 (SQLite) client.
//   Production: Cloudflare's REST API, with CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (needs "D1: Edit").
//   Tests / offline: set D1_LOCAL=/path/to/file.sqlite to use a local SQLite file with the same SQL.
import { CONFIG, requireConfig } from './config.js';

const API = process.env.CF_API_BASE || 'https://api.cloudflare.com/client/v4';
let dbId = null;
let local = null;

async function localDb() {
  if (!local) {
    const { DatabaseSync } = await import('node:sqlite');
    local = new DatabaseSync(process.env.D1_LOCAL);
    local.exec('PRAGMA foreign_keys = ON');
  }
  return local;
}

async function cf(path, init = {}) {
  const res = await fetch(`${API}/accounts/${CONFIG.d1.accountId}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${CONFIG.d1.token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(30000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const msg = json.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`;
    throw new Error(`D1: ${msg}`);
  }
  return json.result;
}

/** Finds the database id by name (no id to copy around), cached for the process. */
export async function databaseId() {
  if (dbId) return dbId;
  if (CONFIG.d1.databaseId) return (dbId = CONFIG.d1.databaseId);
  requireConfig('d1.accountId', 'd1.token');
  const list = await cf(`/d1/database?name=${encodeURIComponent(CONFIG.d1.name)}`);
  const hit = (list || []).find((d) => d.name === CONFIG.d1.name);
  if (!hit) throw new Error(`D1 database "${CONFIG.d1.name}" not found. Run the "Set up database" workflow first.`);
  return (dbId = hit.uuid);
}

const clean = (params) => params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));

/** Runs one statement, returns result rows (for SELECT or RETURNING) — always an array. */
export async function sql(query, params = []) {
  if (process.env.D1_LOCAL) {
    const db = await localDb();
    const st = db.prepare(query);
    return /^\s*(select|with)|returning/i.test(query) ? st.all(...clean(params)) : (st.run(...clean(params)), []);
  }
  const id = await databaseId();
  const result = await cf(`/d1/database/${id}/query`, { method: 'POST', body: JSON.stringify({ sql: query, params: clean(params) }) });
  return result?.[0]?.results ?? [];
}

/** First row or null. */
export const one = async (query, params) => (await sql(query, params))[0] ?? null;

/** Runs a whole .sql script (several statements, no parameters). */
export async function script(text) {
  if (process.env.D1_LOCAL) return (await localDb()).exec(text);
  const id = await databaseId();
  return cf(`/d1/database/${id}/query`, { method: 'POST', body: JSON.stringify({ sql: text }) });
}

export const now = () => new Date().toISOString();

// JSON columns (SQLite has no arrays): stored as text, parsed on read.
const JSON_COLS = ['anime', 'source_urls', 'source_names', 'media', 'image_candidates'];
export function parseRow(r) {
  if (!r) return r;
  const out = { ...r };
  for (const k of JSON_COLS) if (k in out) out[k] = safeJson(out[k], []);
  if ('fb_posted' in out) out.fb_posted = Boolean(out.fb_posted);
  if ('enabled' in out) out.enabled = Boolean(out.enabled);
  if ('pinned' in out) out.pinned = Boolean(out.pinned);
  return out;
}
export const toJson = (v) => JSON.stringify(v ?? []);
function safeJson(v, fallback) {
  if (v == null || v === '') return fallback;
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

/** Builds "a = ?, b = ?" + params from an object (JSON-encodes arrays/objects). */
export function setClause(obj) {
  const keys = Object.keys(obj);
  return {
    clause: keys.map((k) => `${k} = ?`).join(', '),
    params: keys.map((k) => (obj[k] !== null && typeof obj[k] === 'object' ? JSON.stringify(obj[k]) : obj[k])),
  };
}

/** INSERT a row from an object (arrays/objects stored as JSON). Returns the new row's id. */
export async function insert(table, obj, { orIgnore = false } = {}) {
  const keys = Object.keys(obj);
  const params = keys.map((k) => (obj[k] !== null && typeof obj[k] === 'object' ? JSON.stringify(obj[k]) : obj[k]));
  const rows = await sql(
    `INSERT ${orIgnore ? 'OR IGNORE ' : ''}INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')}) RETURNING *`,
    params,
  );
  return parseRow(rows[0]) ?? null;
}

/** "?, ?, ?" for an IN (...) list. */
export const marks = (arr) => arr.map(() => '?').join(', ');
