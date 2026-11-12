import { hueFor } from '@/lib/site';

/** The article's image, or a colour cover generated from the anime name. */
/** Alt text for a story's cover: says what the picture shows (official art of the show), not just its name. */
export function coverAlt(a) {
  const show = a?.anime?.[0];
  const credit = a?.cover_credit ? String(a.cover_credit).split('·')[0].trim() : '';
  if (credit && show && credit.toLowerCase().includes(show.toLowerCase())) return credit;
  return show ? `${show} official artwork for "${a.title}"` : `Cover image for "${a?.title ?? ''}"`;
}

export default function Cover({ label = '', alt, image, credit, eager = false, className = '' }) {
  return (
    <div className={`cover ${className}`} style={{ '--h': hueFor(label) }} aria-hidden={image ? undefined : true}>
      {image ? (
        <>
          <img src={image} alt={alt || label} loading={eager ? 'eager' : 'lazy'} decoding="async" fetchPriority={eager ? 'high' : undefined} />
          {credit && <small className="credit">{credit}</small>}
        </>
      ) : (
        <b>{label}</b>
      )}
    </div>
  );
}
