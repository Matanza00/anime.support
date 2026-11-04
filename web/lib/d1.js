// Build-time D1 access over Cloudflare's REST API (server only; the token never reaches the browser).
const API = process.env.CF_API_BASE || 'https://api.cloudflare.com/client/v4';
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const NAME = process.env.D1_DATABASE_NAME || 'anime-support';
let dbId = process.env.D1_DATABASE_ID || null;

export const d1Configured = () => Boolean(ACCOUNT && TOKEN);

async function cf(path, init = {}) {
  const res = await fetch(`${API}/accounts/${ACCOUNT}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(`[d1] ${json.errors?.map((e) => e.message).join('; ') || res.status}`);
  return json.result;
}

export async function query(sql, params = []) {
  if (!dbId) {
    const hit = (await cf(`/d1/database?name=${encodeURIComponent(NAME)}`)).find((d) => d.name === NAME);
    if (!hit) throw new Error(`[d1] database "${NAME}" not found`);
    dbId = hit.uuid;
  }
  const result = await cf(`/d1/database/${dbId}/query`, { method: 'POST', body: JSON.stringify({ sql, params }) });
  return result?.[0]?.results ?? [];
}

const JSON_COLS = ['anime', 'source_urls', 'source_names', 'media'];
export function parseRow(r) {
  const out = { ...r };
  for (const k of JSON_COLS) {
    if (typeof out[k] === 'string') {
      try {
        out[k] = JSON.parse(out[k]);
      } catch {
        out[k] = [];
      }
    }
    out[k] ??= [];
  }
  return out;
}
