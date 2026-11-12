// Source of out/_redirects (renamed after the build by scripts/finish-build.mjs; Next.js won't route a file
// starting with "_"). Cloudflare answers these with a permanent 301 before serving any page, so duplicate
// anime URLs (other spellings or titles of a show) pass their ranking to the one page that's kept.
import { animeRedirects } from '@/lib/catalog';

export const dynamic = 'force-static';
const LIMIT = 1900; // Cloudflare allows 2,000 static rules

export async function GET() {
  const lines = [];
  for (const [from, to] of await animeRedirects()) lines.push(`${from} ${to} 301`, `${from.replace(/\/$/, '')} ${to} 301`);
  return new Response(lines.slice(0, LIMIT).join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
