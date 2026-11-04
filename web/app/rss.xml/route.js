import { allArticles } from '@/lib/db';
import { SITE, absUrl, articlePath } from '@/lib/site';

export const dynamic = 'force-static';
const x = (s = '') => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

export async function GET() {
  const items = (await allArticles()).slice(0, 50).map((a) => `    <item>
      <title>${x(a.title)}</title>
      <link>${absUrl(articlePath(a.slug))}</link>
      <guid isPermaLink="true">${absUrl(articlePath(a.slug))}</guid>
      <pubDate>${new Date(a.published_at).toUTCString()}</pubDate>
      <description>${x(a.excerpt)}</description>
${(a.anime ?? []).map((t) => `      <category>${x(t)}</category>`).join('\n')}${a.cover_url ? `\n      <enclosure url="${x(absUrl(a.cover_url))}" type="image/${a.cover_url.endsWith('.webp') ? 'webp' : 'jpeg'}" length="0" />` : ''}
    </item>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${x(SITE.name)}</title>
    <link>${SITE.url}/</link>
    <description>${x(SITE.tagline)}</description>
    <language>en</language>
    <atom:link href="${SITE.url}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
