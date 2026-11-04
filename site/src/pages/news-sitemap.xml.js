// Google News sitemap: only articles from the last 48 hours (Google's rule), max 1000.
import { allArticles } from '../lib/db.js';
import { SITE } from '../lib/site.js';

const x = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

export async function GET() {
  const since = Date.now() - 48 * 3600e3;
  const recent = (await allArticles()).filter((a) => new Date(a.published_at).getTime() >= since).slice(0, 1000);
  const urls = recent
    .map(
      (a) => `  <url>
    <loc>${SITE.url}/news/${a.slug}</loc>
    <news:news>
      <news:publication><news:name>${x(SITE.name)}</news:name><news:language>en</news:language></news:publication>
      <news:publication_date>${new Date(a.published_at).toISOString()}</news:publication_date>
      <news:title>${x(a.title)}</news:title>
    </news:news>${a.cover_url ? `\n    <image:image><image:loc>${x(new URL(a.cover_url, SITE.url + '/').toString())}</image:loc></image:image>` : ''}
  </url>`,
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
