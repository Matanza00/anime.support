// The five evergreen guides the bot writes per franchise (bot/src/guides.js). Their slug is always
// `${slugify(name)}-${type}` and they're tagged with the franchise name, which is how they're recognised here.
import { slugify } from './site.js';

export const GUIDE_TYPES = [
  { type: 'watch-order', label: 'Watch order', blurb: (n) => `The best order to watch ${n}, films and specials included` },
  { type: 'where-to-watch', label: 'Where to watch', blurb: (n) => `Every official, legal way to stream ${n}` },
  { type: 'beginners-guide', label: "Beginner's guide", blurb: (n) => `New to ${n}? What it's about and where to start` },
  { type: 'how-long-to-watch', label: 'How long to watch', blurb: (n) => `Total episodes, hours and what you can skip` },
  { type: 'whats-next', label: "What's next", blurb: (n) => `New seasons, films and episodes confirmed for ${n}` },
];

/** The guide type of an article, or null when it's a regular news story. */
export function guideType(a) {
  const name = a?.anime?.[0];
  if (!name) return null;
  return GUIDE_TYPES.find((g) => a.slug === `${slugify(name)}-${g.type}`)?.type ?? null;
}

/** A show's guides in reading order, one per type. */
export function guidesIn(articles = []) {
  const byType = new Map();
  for (const a of articles) {
    const t = guideType(a);
    if (t && !byType.has(t)) byType.set(t, a);
  }
  return GUIDE_TYPES.filter((g) => byType.has(g.type)).map((g) => ({ ...g, article: byType.get(g.type) }));
}
