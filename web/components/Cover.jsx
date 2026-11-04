import { hueFor } from '@/lib/site';

/** The article's image, or a colour cover generated from the anime name. */
export default function Cover({ label = '', image, credit, eager = false, className = '' }) {
  return (
    <div className={`cover ${className}`} style={{ '--h': hueFor(label) }} aria-hidden={image ? undefined : true}>
      {image ? (
        <>
          <img src={image} alt={label} loading={eager ? 'eager' : 'lazy'} decoding="async" fetchPriority={eager ? 'high' : undefined} />
          {credit && <small className="credit">{credit}</small>}
        </>
      ) : (
        <b>{label}</b>
      )}
    </div>
  );
}
