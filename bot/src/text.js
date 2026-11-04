// Pure helpers (unit tested in test/text.test.js)

const STOP = new Set(
  'a an the and or of to in on for with at by from is are was were be been its it this that as new anime manga season part episode episodes reveals revealed announced announces gets confirms confirmed official trailer visual key video teaser premiere premieres date first'.split(
    ' ',
  ),
);

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

export function tokens(title) {
  return new Set(
    String(title)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w)),
  );
}

export function similarity(a, b) {
  const A = a instanceof Set ? a : tokens(a);
  const B = b instanceof Set ? b : tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size); // overlap coefficient: robust to long vs short headlines
}

/**
 * Groups headlines about the same story. Items: [{ id, title, ... }].
 * Returns arrays of items; threshold tuned so "JJK S3 cast" and "Jujutsu Kaisen season 3 adds cast" stay
 * together only when they share enough distinctive words.
 */
export function clusterItems(items, threshold = 0.6) {
  const clusters = [];
  for (const item of items) {
    const t = tokens(item.title);
    const home = clusters.find((c) => similarity(c.tokens, t) >= threshold);
    if (home) {
      home.items.push(item);
      for (const w of t) home.tokens.add(w);
    } else {
      clusters.push({ tokens: new Set(t), items: [item] });
    }
  }
  return clusters.map((c) => c.items);
}

export function clusterKeyFor(title) {
  return [...tokens(title)].sort().slice(0, 8).join('-').slice(0, 120);
}

/** Visible paragraph text from an HTML page, for fact extraction only. */
export function extractText($, maxChars = 6000) {
  $('script, style, nav, header, footer, aside, form, noscript, iframe').remove();
  const scope = $('article').length ? $('article') : $('main').length ? $('main') : $('body');
  const parts = [];
  scope.find('h1, h2, h3, p, li').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t.length > 30) parts.push(t);
  });
  return parts.join('\n').slice(0, maxChars);
}

export function stripHtml(html = '') {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
