'use client';
// "Ep 6 in 1d 4h", computed in the visitor's browser so it stays right between site builds.
import { useEffect, useState } from 'react';

export function untilText(sec) {
  if (sec <= 0) return 'out now';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

export default function NextEpisode({ at, ep, short = false }) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now() / 1000);
    const t = setInterval(() => setNow(Date.now() / 1000), 30000);
    return () => clearInterval(t);
  }, []);
  if (!at) return null;
  const label = ep ? `Ep ${ep}` : 'Next episode';
  if (now === null) return <span className="next-ep">{label}</span>;
  const left = at - now;
  if (left <= 0) return <span className="next-ep">{label} {left > -7 * 86400 ? 'out now' : ''}</span>;
  if (short) return <span className="next-ep">{label} in {untilText(left)}</span>;
  const when = new Date(at * 1000).toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <span className="next-ep">
      <strong>{label}</strong> in {untilText(left)} · {when} your time
    </span>
  );
}
