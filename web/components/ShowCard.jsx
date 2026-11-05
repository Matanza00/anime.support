import { formatLabel, statusLabel } from '@/lib/catalog';
import { hueFor } from '@/lib/site';
import NextEpisode from './NextEpisode';

/** Portrait poster card for one show in the catalog. */
export default function ShowCard({ show: s, rank, eager = false, detail }) {
  const year = s.season_year || s.start_date?.slice(0, 4);
  return (
    <a className="show-card" href={`/anime/${s.slug}/`}>
      <div className="poster" style={{ '--h': hueFor(s.title), '--c': s.cover_color || undefined }}>
        {s.cover_url ? <img src={s.cover_url} alt={s.title} loading={eager ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" /> : <b>{s.title}</b>}
        {rank && <span className="rank">{rank}</span>}
        {s.score ? <span className="score" title="AniList average score">{s.score}%</span> : null}
      </div>
      <div className="info">
        <h3>{s.title}</h3>
        <div className="meta">
          <span>{formatLabel(s.format)}</span>
          {year && <span>{year}</span>}
          {detail ?? (s.status === 'RELEASING' && s.next_airing_at ? <NextEpisode at={s.next_airing_at} ep={s.next_episode} short /> : <span>{statusLabel(s.status)}</span>)}
        </div>
      </div>
    </a>
  );
}

export function ShowGrid({ shows, ranked = false, eager = 0 }) {
  if (!shows.length) return null;
  return (
    <div className="show-grid">
      {shows.map((s, i) => <ShowCard key={s.id} show={s} rank={ranked ? i + 1 : undefined} eager={i < eager} />)}
    </div>
  );
}
