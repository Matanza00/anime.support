import Cover, { coverAlt } from './Cover';
import { articlePath, catLabel, formatDate } from '@/lib/site';

export function Pill({ category }) {
  return <span className={`pill ${category}`}>{catLabel(category)}</span>;
}

export default function Card({ article: a }) {
  return (
    <a className="card glass" href={articlePath(a.slug)}>
      <Cover label={a.anime?.[0] ?? catLabel(a.category)} alt={coverAlt(a)} image={a.cover_url} />
      <div className="body">
        <div><Pill category={a.category} /></div>
        <h3>{a.title}</h3>
        <p>{a.excerpt}</p>
        <div className="meta">
          <time dateTime={a.published_at}>{formatDate(a.published_at)}</time>
          {a.anime?.[0] && <span>{a.anime[0]}</span>}
        </div>
      </div>
    </a>
  );
}

export function RowCard({ article: a }) {
  return (
    <a className="row-card glass" href={articlePath(a.slug)}>
      <Cover label={a.anime?.[0] ?? catLabel(a.category)} alt={coverAlt(a)} image={a.cover_url} />
      <div>
        <h3>{a.title}</h3>
        <div className="meta" style={{ marginTop: 6 }}>
          <time dateTime={a.published_at}>{formatDate(a.published_at)}</time>
        </div>
      </div>
    </a>
  );
}
