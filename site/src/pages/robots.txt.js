import { SITE } from '../lib/site.js';

export function GET() {
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap-index.xml\nSitemap: ${SITE.url}/news-sitemap.xml\n`, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
