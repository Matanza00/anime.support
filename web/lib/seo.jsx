import { SITE, absUrl } from './site.js';

export const publisher = {
  '@type': 'Organization',
  '@id': `${SITE.url}/#org`,
  name: SITE.name,
  url: `${SITE.url}/`,
  alternateName: ['Anime Support', 'animesupport'],
  logo: { '@type': 'ImageObject', url: absUrl('/brand/logo.png'), width: 1200, height: 488 },
};

/** Open Graph fields every page needs. A page's own openGraph replaces the site-wide one in Next.js, so pages spread this in. */
export const ogBase = { siteName: SITE.name, locale: 'en_US' };

export function breadcrumbs(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: absUrl(path) })),
  };
}

export function JsonLd({ data }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
