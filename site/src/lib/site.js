const env = import.meta.env;

export const SITE = {
  name: env.PUBLIC_SITE_NAME || 'anime.support',
  tagline: env.PUBLIC_SITE_TAGLINE || "Anime news, release dates and what's coming next",
  url: (env.PUBLIC_SITE_URL || 'https://anime.support').replace(/\/$/, ''),
  email: env.PUBLIC_CONTACT_EMAIL || 'contact@example.com',
  adsClient: env.PUBLIC_ADSENSE_CLIENT || '',
  adSlots: {
    top: env.PUBLIC_ADSENSE_SLOT_TOP || '',
    inArticle: env.PUBLIC_ADSENSE_SLOT_INARTICLE || '',
    bottom: env.PUBLIC_ADSENSE_SLOT_BOTTOM || '',
  },
  ga4: env.PUBLIC_GA4_ID || '',
  supabaseUrl: env.PUBLIC_SUPABASE_URL || '',
  supabaseAnon: env.PUBLIC_SUPABASE_ANON_KEY || '',
};

export const CATEGORY_LABEL = {
  news: 'News',
  upcoming: 'Upcoming',
  release: 'New release',
  feature: 'Feature',
};

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Stable hue per anime so every show gets its own cover colour. */
export function hueFor(text = '') {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function readingTime(md = '') {
  return Math.max(1, Math.round(md.split(/\s+/).length / 220));
}
