// Compact index for the instant search page. Stories: {s,t,a,e}. Shows: {k:'a', s, t, a (other titles), e, c}.
import { allArticles } from '@/lib/db';
import { allShows, formatLabel, statusLabel } from '@/lib/catalog';

export const dynamic = 'force-static';

export async function GET() {
  const stories = (await allArticles()).map((a) => ({ s: a.slug, t: a.title, a: a.anime ?? [], e: a.excerpt }));
  const shows = (await allShows()).map((x) => ({
    k: 'a',
    s: x.slug,
    t: x.title,
    a: [x.title_romaji, ...(x.synonyms ?? [])].filter((y) => y && y !== x.title).slice(0, 4),
    e: [formatLabel(x.format), x.season_year || x.start_date?.slice(0, 4), statusLabel(x.status), x.studios?.[0]].filter(Boolean).join(' · '),
    c: x.cover_url || undefined,
  }));
  return Response.json([...stories, ...shows]);
}
