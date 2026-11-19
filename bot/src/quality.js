// Publishing bar for automatic articles (after the AdSense "low-value content" review):
// long enough to add something, and not a near-copy of a story we already ran about the same show.
import { sql } from './d1.js';

export const MIN_WORDS = 300;
export const words = (md) => String(md || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/https?:\/\/\S+/g, '').split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;

const STOP = new Set('the a an of for and to in on with as at by is are its new first season anime film movie series episode reveals unveils announces announced gets sets adds'.split(' '));
const terms = (t) => new Set(String(t).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
function overlap(a, b) {
  const A = terms(a), B = terms(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size);
}

/** Why a story shouldn't go live on its own, or null if it can. */
export async function qualityProblem({ title, body, anime = [], id = null }) {
  const n = words(body);
  if (n < MIN_WORDS) return `only ${n} words (needs ${MIN_WORDS})`;
  const show = String(anime[0] || '').toLowerCase();
  if (!show) return null;
  const since = new Date(Date.now() - 3 * 864e5).toISOString();
  const recent = await sql("SELECT id, title, anime FROM articles WHERE status = 'published' AND published_at >= ?", [since]);
  for (const r of recent) {
    if (r.id === id) continue;
    let first = '';
    try { first = String(JSON.parse(r.anime)[0] || '').toLowerCase(); } catch {}
    if (first === show && overlap(title, r.title) >= 0.5) return `too close to "${r.title}"`;
  }
  return null;
}
