// Compact index for the instant search page: slug, title, anime, excerpt.
import { allArticles } from '@/lib/db';

export const dynamic = 'force-static';

export async function GET() {
  const data = (await allArticles()).map((a) => ({ s: a.slug, t: a.title, a: a.anime ?? [], e: a.excerpt }));
  return Response.json(data);
}
