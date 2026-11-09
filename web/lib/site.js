const e = process.env;

export const SITE = {
  name: e.NEXT_PUBLIC_SITE_NAME || 'anime.support',
  tagline: e.NEXT_PUBLIC_SITE_TAGLINE || "Anime news, release dates and what's coming next",
  url: (e.NEXT_PUBLIC_SITE_URL || 'https://anime.support').replace(/\/$/, ''),
  email: e.NEXT_PUBLIC_CONTACT_EMAIL || 'contact@anime.support',
  adsClient: e.NEXT_PUBLIC_ADSENSE_CLIENT || '',
  adSlots: {
    top: e.NEXT_PUBLIC_ADSENSE_SLOT_TOP || '',
    inArticle: e.NEXT_PUBLIC_ADSENSE_SLOT_INARTICLE || '',
    bottom: e.NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM || '',
  },
  ga4: e.NEXT_PUBLIC_GA4_ID || '',
  gtm: e.NEXT_PUBLIC_GTM_ID || '',
};

/** The four sections, their labels and their URLs. */
export const CATEGORIES = {
  news: { label: 'News', path: '/news/', blurb: 'Breaking anime and manga news, confirmed by official sources.' },
  upcoming: { label: 'Upcoming', path: '/upcoming/', blurb: 'New seasons, films and release dates that are officially on the way.' },
  release: { label: 'Out now', path: '/releases/', blurb: 'Episodes, films and volumes you can watch or read right now.' },
  feature: { label: 'Features', path: '/features/', blurb: 'Explainers, guides and deep dives for anime fans.' },
};

export const catLabel = (c) => CATEGORIES[c]?.label ?? 'News';
export const absUrl = (p = '/') => new URL(p, SITE.url + '/').toString();
export const articlePath = (slug) => `/news/${slug}/`;

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function formatDate(iso, opts = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });
}

/** Stable hue per anime, for generated covers. */
export function hueFor(text = '') {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function readingTime(md = '') {
  return Math.max(1, Math.round(String(md).split(/\s+/).length / 220));
}
