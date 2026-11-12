'use client';
// Weekly airing schedule. The page is built with UTC days; the visitor's browser then regroups every
// episode into their own time zone and keeps the "in 3h" countdowns live.
import { useEffect, useMemo, useState } from 'react';
import { untilText } from './NextEpisode';

const dayKey = (sec, tz) => new Date(sec * 1000).toLocaleDateString('en-CA', { timeZone: tz });
const dayName = (key, tz, todayKey) => {
  const d = new Date(key + 'T12:00:00Z');
  const label = d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric' });
  if (key === todayKey) return `Today · ${label}`;
  return label;
};
const timeOf = (sec, tz) => new Date(sec * 1000).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });

export default function Schedule({ slots, builtAt, compact = false, limitDays, maxItems }) {
  const [tz, setTz] = useState('UTC');
  const [now, setNow] = useState(builtAt);
  const [kind, setKind] = useState('all');

  useEffect(() => {
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    } catch {}
    setNow(Math.floor(Date.now() / 1000));
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 60000);
    return () => clearInterval(t);
  }, []);

  const todayKey = dayKey(now, tz);
  const days = useMemo(() => {
    const map = new Map();
    for (const s of slots) {
      if (kind === 'anime' && s.k === 'CN') continue;
      if (kind === 'donghua' && s.k !== 'CN') continue;
      const key = dayKey(s.t, tz);
      if (key < todayKey) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    let list = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    if (limitDays) list = list.slice(0, limitDays);
    if (maxItems) {
      // keep what is still to come, plus a few that just aired
      list = list.map(([k, l]) => [k, l.filter((x) => x.t > now - 6 * 3600).slice(0, maxItems)]).filter(([, l]) => l.length);
    }
    return list;
  }, [slots, tz, todayKey, kind, limitDays, maxItems, now]);

  return (
    <div className="schedule">
      {!compact && (
        <div className="sched-bar">
          <div className="tabs" role="group" aria-label="Show">
            {[['all', 'Everything'], ['anime', 'Anime'], ['donghua', 'Donghua']].map(([k, l]) => (
              <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>
            ))}
          </div>
          <nav className="tabs" aria-label="Days">
            {days.map(([key]) => (
              <a key={key} className="chip" href={`#day-${key}`}>{key === todayKey ? 'Today' : (() => { const d = new Date(key + 'T12:00:00Z'); return `${d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' })} ${d.getUTCDate()}`; })()}</a>
            ))}
          </nav>
          <p className="meta">Times in {tz === 'UTC' ? 'UTC' : `your time zone (${tz})`}. Japanese broadcast times; streaming services may add episodes a little later.</p>
        </div>
      )}
      {days.length === 0 && <div className="glass empty">No episodes scheduled yet. The schedule refreshes every day.</div>}
      {days.map(([key, list]) => (
        <section key={key} id={`day-${key}`} className="sched-day">
          <h2>{dayName(key, tz, todayKey)} <small>{list.length} episode{list.length === 1 ? '' : 's'}</small></h2>
          <ol className="sched-list">
            {list.map((s) => {
              const left = s.t - now;
              return (
                <li key={`${s.s}-${s.e}`} className={left <= 0 ? 'aired' : ''}>
                  <time dateTime={new Date(s.t * 1000).toISOString()}>{timeOf(s.t, tz)}</time>
                  <a href={`/anime/${s.s}/`} className="sched-show">
                    <span className="thumb" style={{ background: s.col || undefined }}>{s.c && <img src={s.c} alt={`${s.n} cover`} loading="lazy" referrerPolicy="no-referrer" />}</span>
                    <span>
                      <strong>{s.n}</strong>
                      <small>Episode {s.e}{s.of ? ` of ${s.of}` : ''}{s.k === 'CN' ? ' · Donghua' : ''}</small>
                    </span>
                  </a>
                  <span className={`when ${left <= 0 ? 'done' : left < 3 * 3600 ? 'soon' : ''}`}>{left <= 0 ? 'Aired' : `in ${untilText(left)}`}</span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
