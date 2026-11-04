// Minimal robots.txt check so the bot only reads pages a site allows bots to read.
import { CONFIG } from './config.js';

const cache = new Map(); // host -> { rules, at }

function parse(txt) {
  const groups = [];
  let cur = null;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^(user-agent|allow|disallow)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [, key, val] = m;
    if (/user-agent/i.test(key)) {
      if (!cur || cur.rules.length) groups.push((cur = { agents: [], rules: [] }));
      cur.agents.push(val.toLowerCase());
    } else if (cur) cur.rules.push({ allow: /allow/i.test(key) && !/dis/i.test(key), path: val });
  }
  const ours = groups.find((g) => g.agents.some((a) => a !== '*' && 'animesupportbot'.includes(a)));
  return (ours || groups.find((g) => g.agents.includes('*')))?.rules ?? [];
}

export async function allowedByRobots(url) {
  const u = new URL(url);
  let entry = cache.get(u.host);
  if (!entry || Date.now() - entry.at > 24 * 3600e3) {
    let rules = [];
    try {
      const res = await fetch(`${u.protocol}//${u.host}/robots.txt`, { headers: { 'User-Agent': CONFIG.userAgent }, signal: AbortSignal.timeout(10000) });
      if (res.ok) rules = parse(await res.text());
    } catch {
      /* unreachable robots.txt = no rules */
    }
    cache.set(u.host, (entry = { rules, at: Date.now() }));
  }
  const path = u.pathname + u.search;
  let best = { allow: true, len: -1 };
  for (const r of entry.rules) {
    if (!r.path) continue;
    const re = new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(path) && r.path.length > best.len) best = { allow: r.allow, len: r.path.length };
  }
  return best.allow;
}
