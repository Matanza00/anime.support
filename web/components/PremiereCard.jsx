import Countdown from './Countdown';
import { formatLabel, officialSources } from '@/lib/catalog';
import { hueFor } from '@/lib/site';

const fmt = (d, opts) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });

/** A show with an announced premiere: poster, date, countdown, and where the date was announced. */
export default function PremiereCard({ show: s, precision = 'day' }) {
  const src = officialSources(s);
  return (
    <article className="prem-card glass">
      <a href={`/anime/${s.slug}/`} className="prem-poster" style={{ '--h': hueFor(s.title), '--c': s.cover_color || undefined }} tabIndex={-1} aria-hidden="true">
        {s.cover_url && <img src={s.cover_url} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      </a>
      <div className="prem-body">
        <span className="date">
          {precision === 'day' ? fmt(s.start_date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : precision === 'month' ? `${fmt(s.start_date, { month: 'long', year: 'numeric' })} · day TBA` : s.season ? `${s.season[0] + s.season.slice(1).toLowerCase()} ${s.season_year}` : s.season_year || s.start_date?.slice(0, 4) || 'Date TBA'}
        </span>
        {precision === 'day' && <Countdown date={s.start_date} />}
        <h3><a href={`/anime/${s.slug}/`}>{s.title}</a></h3>
        <span className="meta">
          <span>{formatLabel(s.format)}</span>
          {s.studios?.[0] && <span>{s.studios[0]}</span>}
          {s.country === 'CN' && <span>Donghua</span>}
        </span>
        {src.length > 0 && (
          <span className="prem-src">
            Official sources: {src.map((x, i) => <span key={x.url}>{i ? ' · ' : ''}<a href={x.url} target="_blank" rel="noopener nofollow">{x.label}</a></span>)}
          </span>
        )}
      </div>
    </article>
  );
}
