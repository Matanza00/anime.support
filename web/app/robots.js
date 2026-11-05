import { SITE } from '@/lib/site';

export const dynamic = 'force-static';

export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/search/', '/account/', '/studio-admin/', '/api/'] }],
    sitemap: [`${SITE.url}/sitemap.xml`, `${SITE.url}/news-sitemap.xml`],
    host: SITE.url,
  };
}
