// Source of out/_redirects (renamed after the build by scripts/finish-build.mjs; Next.js won't route a file
// starting with "_"). Cloudflare answers these with a permanent 301 before serving any page, so duplicate
// anime URLs (other spellings or titles of a show) pass their ranking to the one page that's kept.
import { animeRedirects, animeHref } from '@/lib/catalog';
import { removedArticles, allArticles } from '@/lib/db';

export const dynamic = 'force-static';
const LIMIT = 1900; // Cloudflare allows 2,000 static rules

export async function GET() {
  const lines = [];
  for (const [from, to] of await animeRedirects()) lines.push(`${from} ${to} 301`, `${from.replace(/\/$/, '')} ${to} 301`);
  // stories taken off the site: send readers (and Google) to the show's page, or the news page
  const live = new Set((await allArticles()).map((a) => a.slug));
  for (const a of await removedArticles()) {
    if (live.has(a.slug)) continue;
    const show = a.anime?.[0] ? await animeHref(a.anime[0]) : '';
    const to = show.startsWith('/anime/') ? show : '/news/';
    lines.push(`/news/${a.slug}/ ${to} 301`, `/news/${a.slug} ${to} 301`);
  }
  return new Response(lines.slice(0, LIMIT).join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
