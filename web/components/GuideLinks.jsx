import { articlePath } from '@/lib/site';

/**
 * The guide cluster for one show: watch order, where to watch, beginner's guide, how long, what's next.
 * Used on the show page and under every guide/story about the show, so the pages link to each other.
 */
export default function GuideLinks({ name, guides, current, hubHref, title }) {
  if (!guides?.length) return null;
  const id = `guides-${current || 'hub'}`;
  return (
    <section className="guide-links glass" aria-labelledby={id}>
      <h2 id={id}>{title || `${name} guides`}</h2>
      <ol>
        {guides.map((g) => (
          <li key={g.type} className={g.article.slug === current ? 'on' : undefined}>
            {g.article.slug === current ? (
              <span aria-current="page"><b>{g.label}</b><small>You are reading this guide</small></span>
            ) : (
              <a href={articlePath(g.article.slug)}><b>{g.label}</b><small>{g.blurb(name)}</small></a>
            )}
          </li>
        ))}
      </ol>
      {hubHref && <p className="meta"><a href={hubHref}>Everything about {name}: news, episodes and where to watch →</a></p>}
    </section>
  );
}
