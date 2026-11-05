'use client';
// A contest tile whose phase and countdown are worked out in the visitor's browser (pages are built ahead of time).
import { useEffect, useState } from 'react';
import { timeLeft, PHASE_LABEL } from '@/lib/studio-client';

const CAT_ICON = { '2d-art': '🖌️', '3d-character': '🧍', '3d-environment': '🏯', motion: '🎞️' };

export default function ContestCard({ c, label }) {
  const [now, setNow] = useState(null);
  useEffect(() => setNow(new Date().toISOString()), []);
  const p = !now ? null : now < c.submit_opens_at ? 'upcoming' : now < c.submit_closes_at ? 'submissions' : now < c.vote_closes_at ? 'voting' : 'results';
  const deadline = p === 'upcoming' ? c.submit_opens_at : p === 'submissions' ? c.submit_closes_at : p === 'voting' ? c.vote_closes_at : null;
  return (
    <a className={`contest-card glass${p ? ` phase-${p}` : ''}`} href={`/contests/${c.slug}/`}>
      <span className="cat"><span aria-hidden="true">{CAT_ICON[c.category]}</span> {label}</span>
      <h3>{c.title}</h3>
      <p>{c.theme}</p>
      <div className="contest-meta">
        <span className="phase-pill">{p ? PHASE_LABEL[p] : ' '}</span>
        {deadline && <span className="meta">{timeLeft(deadline)}</span>}
      </div>
      {c.prize && <span className="prize">🏆 {c.prize}</span>}
    </a>
  );
}
